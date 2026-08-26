import { adminClient, corsHeaders, json, toBrazilE164 } from '../_shared/whatsapp.ts'

/**
 * Lembrete automatico de consulta.
 *
 * Roda uma vez por dia pelo pg_cron e avisa quem tem consulta daqui a N dias
 * (padrao 1, ou seja, a vespera). A mensagem pede que o paciente confirme ou
 * peca para remarcar; a resposta cai no meta-webhook.
 *
 * Duas regras deliberadas, iguais as do disparo de acompanhamentos:
 *  - so envia para quem ja tem consentimento registrado. Um robo nao presume
 *    opt-in em nome da equipe.
 *  - marca reminder_sent_at antes de considerar o trabalho feito, para uma
 *    reexecucao do cron nao mandar a mesma mensagem duas vezes.
 */

type Settings = {
  clinic_id: string
  timezone: string
  phoneNumberId: string
  templateName: string
  templateLanguage: string
  reminderDays: number
  enabled: boolean
}

/**
 * Diferenca, em minutos, entre o fuso da clinica e o UTC naquele instante.
 * A Edge Function roda em UTC: sem isso, perto da meia-noite o lembrete sairia
 * com um dia de diferenca.
 */
function offsetMinutos(timezone: string, referencia: Date) {
  const emUtc = new Date(referencia.toLocaleString('en-US', { timeZone: 'UTC' }))
  const noFuso = new Date(referencia.toLocaleString('en-US', { timeZone: timezone }))
  return Math.round((noFuso.getTime() - emUtc.getTime()) / 60000)
}

/**
 * Janela [inicio, fim) em UTC correspondente ao dia da consulta, contado no
 * calendario da clinica: hoje + `dias`.
 */
function janelaDoDia(timezone: string, dias: number) {
  const agora = new Date()
  const local = new Date(agora.toLocaleString('en-US', { timeZone: timezone }))
  local.setDate(local.getDate() + dias)

  const meiaNoiteIngenua = Date.UTC(local.getFullYear(), local.getMonth(), local.getDate())
  const offset = offsetMinutos(timezone, agora) * 60000
  const inicio = new Date(meiaNoiteIngenua - offset)
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)

  const rotulo = new Date(meiaNoiteIngenua).toISOString().slice(0, 10)
  return { inicio, fim, rotulo }
}

function formatarDataHora(iso: string, timezone: string) {
  const data = new Date(iso)
  const dataBR = data.toLocaleDateString('pt-BR', { timeZone: timezone })
  const hora = data.toLocaleTimeString('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  })
  return { dataBR, hora }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  const expected = Deno.env.get('CRON_SECRET')?.trim()
  if (!expected) return json({ error: 'CRON_SECRET não configurado no servidor.' }, 503)
  if (req.headers.get('x-cron-secret')?.trim() !== expected) return json({ error: 'Não autorizado.' }, 401)

  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN')?.trim()
  if (!token) return json({ error: 'Token do WhatsApp não configurado.' }, 503)

  try {
    const admin = adminClient()
    const graphVersion = Deno.env.get('META_GRAPH_VERSION')?.trim() || 'v25.0'

    const { data: linhas, error: settingsError } = await admin
      .from('clinic_settings')
      .select(
        'clinic_id,whatsapp_phone_number_id,whatsapp_reminder_template_name,whatsapp_template_language,' +
          'appointment_reminder_days,appointment_reminder_enabled,clinics(timezone)',
      )
      .eq('appointment_reminder_enabled', true)
      .not('whatsapp_phone_number_id', 'is', null)

    if (settingsError) {
      console.error('Settings lookup failed', settingsError)
      return json({ error: 'Erro ao ler as configurações.', details: settingsError.message }, 500)
    }

    const clinicas: Settings[] = (linhas ?? []).map((linha) => ({
      clinic_id: linha.clinic_id,
      timezone:
        (linha.clinics as { timezone?: string } | null)?.timezone || 'America/Sao_Paulo',
      phoneNumberId: linha.whatsapp_phone_number_id as string,
      templateName: linha.whatsapp_reminder_template_name || 'lembrete_consulta',
      templateLanguage: linha.whatsapp_template_language || 'pt_BR',
      reminderDays: linha.appointment_reminder_days ?? 1,
      enabled: true,
    }))

    const resumo = { candidatas: 0, enviados: 0, pulados: 0, falhas: 0 }
    const detalhes: { appointmentId: string; resultado: string }[] = []

    for (const clinica of clinicas) {
      const { inicio, fim } = janelaDoDia(clinica.timezone, clinica.reminderDays)

      const { data: consultas, error: consultasError } = await admin
        .from('appointments')
        .select('id,patient_id,starts_at,unit_id,clinic_units(name)')
        .eq('clinic_id', clinica.clinic_id)
        .eq('status', 'scheduled')
        .is('reminder_sent_at', null)
        .gte('starts_at', inicio.toISOString())
        .lt('starts_at', fim.toISOString())
        .not('patient_id', 'is', null)
        .order('starts_at', { ascending: true })
        .limit(200)

      if (consultasError) {
        console.error('Appointment lookup failed', consultasError)
        continue
      }

      resumo.candidatas += consultas?.length ?? 0

      for (const consulta of consultas ?? []) {
        const { data: paciente } = await admin
          .from('patients')
          .select('id,name,phone,whatsapp_opt_in_at,whatsapp_opt_out_at')
          .eq('id', consulta.patient_id)
          .single()

        if (!paciente?.phone || paciente.whatsapp_opt_out_at || !paciente.whatsapp_opt_in_at) {
          resumo.pulados += 1
          detalhes.push({
            appointmentId: consulta.id,
            resultado: paciente?.whatsapp_opt_out_at ? 'opt-out' : 'sem consentimento',
          })
          continue
        }

        const waId = toBrazilE164(paciente.phone)
        const agora = new Date().toISOString()
        const { dataBR, hora } = formatarDataHora(consulta.starts_at, clinica.timezone)
        const unidade = (consulta.clinic_units as { name?: string } | null)?.name || 'a clínica'

        const { data: conversa, error: conversaError } = await admin
          .from('whatsapp_conversations')
          .upsert(
            {
              clinic_id: clinica.clinic_id,
              patient_id: paciente.id,
              wa_id: waId,
              display_phone: paciente.phone,
              status: 'open',
              last_message_at: agora,
            },
            { onConflict: 'clinic_id,wa_id' },
          )
          .select('id')
          .single()

        if (conversaError || !conversa) {
          console.error('Conversation upsert failed', conversaError)
          resumo.falhas += 1
          detalhes.push({ appointmentId: consulta.id, resultado: 'CONVERSATION_FAILED' })
          continue
        }

        const resposta = await fetch(
          `https://graph.facebook.com/${graphVersion}/${clinica.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: waId,
              type: 'template',
              template: {
                name: clinica.templateName,
                language: { code: clinica.templateLanguage },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: paciente.name },
                      { type: 'text', text: dataBR },
                      { type: 'text', text: hora },
                      { type: 'text', text: unidade },
                    ],
                  },
                ],
              },
            }),
          },
        )

        const corpo = await resposta.json()
        const resumoTexto = `Lembrete de consulta em ${dataBR} às ${hora} (${unidade}) enviado para ${paciente.name}.`

        if (!resposta.ok) {
          const motivo = corpo?.error?.message || 'Meta recusou o envio.'
          await admin.from('whatsapp_messages').insert({
            clinic_id: clinica.clinic_id,
            conversation_id: conversa.id,
            patient_id: paciente.id,
            appointment_id: consulta.id,
            direction: 'outbound',
            message_type: 'template',
            template_name: clinica.templateName,
            body: resumoTexto,
            status: 'failed',
            failed_at: agora,
            failure_reason: motivo,
          })
          await admin
            .from('appointments')
            .update({ reminder_failed_at: agora, reminder_failure_reason: motivo })
            .eq('id', consulta.id)
          resumo.falhas += 1
          detalhes.push({ appointmentId: consulta.id, resultado: `META_REJECTED: ${motivo}` })
          continue
        }

        await admin.from('whatsapp_messages').insert({
          clinic_id: clinica.clinic_id,
          conversation_id: conversa.id,
          patient_id: paciente.id,
          appointment_id: consulta.id,
          external_message_id: corpo?.messages?.[0]?.id ?? null,
          direction: 'outbound',
          message_type: 'template',
          template_name: clinica.templateName,
          body: resumoTexto,
          status: 'accepted',
          sent_at: agora,
        })

        await admin
          .from('appointments')
          .update({ reminder_sent_at: agora, reminder_failed_at: null, reminder_failure_reason: null })
          .eq('id', consulta.id)

        resumo.enviados += 1
        detalhes.push({ appointmentId: consulta.id, resultado: 'enviado' })
      }
    }

    console.log('appointment-reminders', JSON.stringify(resumo))
    return json({ ok: true, ...resumo, detalhes })
  } catch (error) {
    console.error(error)
    return json({ error: 'Falha no envio dos lembretes.' }, 500)
  }
})
