"use client"

import React, { useEffect, useState, useMemo } from "react"
import Image from "next/image"
import { BillingPausedNotice } from "@/components/billing/BillingPausedNotice"
import CountdownTimer from "@/components/CountdownTimer"
import type { PublicEventTranslation } from "@/components/events/EventDescriptionBlock"
import { getCommunityLinkLabel, normalizeCommunityLink } from "@/lib/communityLink"
import { getBillingNoticeCopy } from "@/lib/billingNotice"
import type { SupportedLanguageCode } from "@/lib/i18n/languages"
import { getRegistrationWindowStatus, computeNextOccurrenceDate, computeOccurrenceEnd } from "@/lib/recurringEvents"
import { InternationalPhoneInput } from "@/components/registration/InternationalPhoneInput"
import { RegistrationStepIndicator, type RegistrationStep } from "@/components/registration/RegistrationStepIndicator"

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
  allowMultiple?: boolean
  optionLimits?: Record<string, number | null | undefined>
  condition?: { questionId: string; value: string }
}

type EventTicketTier = {
  id: string
  name: string
  presetKey?: string | null
  badgeColor: string
  textColor: string
  metallic: boolean
  prestige: number
  priceKes: number
  currency: string
  capacity: number
  description?: string | null
  soldCount: number
  waitlistCount: number
  bundleSize: number
}

type EventProps = {
  event: {
    slug: string
    title: string
    description?: string | null
    capacity?: number | null
    confirmedCount: number
    questions: EventQuestion[]
    organizerEmail: string
    organizerName?: string | null
    eventDate?: Date | string | null
    eventEndAt?: Date | string | null
    deadline?: Date | string | null
    location?: string | null
    mapDirectionsUrl?: string | null
    entryFeeLabel?: string | null
    showRemainingSpots?: boolean
    attendeeConsentEnabled?: boolean
    attendeeConsentText?: string | null
    communityLink?: string | null
    imageUrl?: string | null
    createdAt: Date | string
    status?: string | null
    isPaid?: boolean
    ticketPrice?: number | null
    ticketTiers?: EventTicketTier[]
    groupRegistrationEnabled?: boolean
    allowGroupSelfClaim?: boolean
    hasSpecificTime?: boolean
    isRecurring?: boolean
    recurrenceFrequency?: string | null
    recurrenceDayOfWeek?: number | null
    registrationOpensDays?: number | null
    registrationOpensTime?: string | null
  }
  showBranding?: boolean
  maxAttendees?: number
  compactHeader?: boolean
}

function BrandingFooter() {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)" }}>
      Powered by{" "}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "rgba(200,245,90,0.4)", textDecoration: "none", transition: "color 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#C8F55A")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(200,245,90,0.4)")}
      >
        EventSlot
      </a>
    </div>
  )
}

function EventSlotWelcomeAvatar() {
  return (
    <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg" style={{
      background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 25%, transparent) 0%, color-mix(in srgb, var(--accent) 8%, var(--surface)) 100%)",
      border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
      boxShadow: "0 8px 24px -4px color-mix(in srgb, var(--accent) 20%, transparent)"
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="var(--accent)" fillOpacity="0.2" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="3" fill="var(--accent)" />
      </svg>
    </div>
  )
}

type AttendeeResult = {
  status: 'confirmed' | 'waitlist'
  waitlistPosition?: number
  registrationId: string
  registrationNumber?: number
  confirmationCode?: string
}

type BulkResult = {
  success: true
  results: AttendeeResult[]
  eventTitle: string
}

type AttendeeAnswers = Record<string, string>

type UploadedFileAnswer = {
  name: string
  type: string
  size: number
  url: string
}

function formatEventDateRange(startValue: Date | string | null | undefined, endValue: Date | string | null | undefined) {
  if (!startValue) return ""

  const start = startValue instanceof Date ? startValue : new Date(startValue)
  if (Number.isNaN(start.getTime())) return ""

  const formatFull = (date: Date) =>
    date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })

  if (!endValue) return formatFull(start)

  const end = endValue instanceof Date ? endValue : new Date(endValue)
  if (Number.isNaN(end.getTime()) || start.toDateString() === end.toDateString()) return formatFull(start)

  return `${formatFull(start)} to ${formatFull(end)}`
}

function parseCheckboxValue(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
  } catch {
    return raw.split("|").map(v => v.trim()).filter(Boolean)
  }
  return []
}

function serializeCheckboxValue(values: string[]): string {
  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  return JSON.stringify(uniqueSorted)
}

function parseFileAnswer(raw: string | undefined): UploadedFileAnswer | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<UploadedFileAnswer>
    if (
      typeof parsed.name === "string" &&
      typeof parsed.url === "string" &&
      typeof parsed.type === "string" &&
      typeof parsed.size === "number"
    ) {
      return { name: parsed.name, url: parsed.url, type: parsed.type, size: parsed.size }
    }
  } catch {
    return null
  }
  return null
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function emptyAnswers(questions: EventQuestion[]): AttendeeAnswers {
  return Object.fromEntries(questions.map(q => [q.id, ""]))
}

type DuplicateInfo = {
  attendeeIndex: number
  registrationNumber: number | null
  name: string
  maskedPhone: string
}

type PendingPayload = {
  eventSlug: string
  attendeesPayload: Array<{ answers: Array<{ questionId: string; value: string }>; baseEmail?: string }>
  consentDataProcessing: boolean
  consentTransactional: boolean
  consentMarketing: boolean
  sendResponseCopy: boolean
  source: string
  refCode?: string
  utmSource?: string
}

type PaidCheckoutResponse = {
  success: true
  orderId: string
  checkoutRequestId: string
  url?: string
  customerMessage: string
  amountKes: number
  eventTitle: string
  ticketTierName: string
  paymentMethod: "mpesa" | "paystack"
}

function getFormCopy(language: SupportedLanguageCode | null) {
  const copy = {
    en: { registrationForm: "Registration form", date: "Date", location: "Location", entryAmount: "Entry amount", hostedBy: "Hosted by", getDirections: "Get directions", venueDirections: "Venue directions", routePreview: "Preview the route and open full directions if needed.", openMap: "Open map", intro: "Fill in the details below to secure your spot. You can save progress with your email and continue later.", saveProgress: "Save your progress with email", restoreProgress: "Open this same link again to restore your saved progress.", registeringOne: "Registering 1 person", registeringMany: "Registering {count} people", attendee: "Attendee", emailAddress: "Email address", forTicket: "for your ticket", select: "Select...", consentTitle: "Consent for Data Processing", consentBody: "Do you consent to {organizer} collecting and using your personal information for registration, event communication, attendee coordination, and event-day planning purposes?", sendCopy: "Send me a copy of my responses.", submit: "Submit", submitting: "Submitting...", submitMany: "Submit {count} responses", closed: "Registration closed", paidPaused: "Paid registration paused", clear: "Clear form", passwordNotice: "Never submit passwords or sensitive financial credentials through this form.", hostNotice: "This form is created by the event organiser and hosted through EventSlot. It is not attendee account signup." },
    sw: { registrationForm: "Fomu ya usajili", date: "Tarehe", location: "Mahali", entryAmount: "Kiasi cha kiingilio", hostedBy: "Imeandaliwa na", getDirections: "Pata maelekezo", venueDirections: "Maelekezo ya ukumbi", routePreview: "Angalia njia kisha ufungue maelekezo kamili ukihitaji.", openMap: "Fungua ramani", intro: "Jaza maelezo hapa chini kuhifadhi nafasi yako. Unaweza kuhifadhi maendeleo kwa barua pepe na kuendelea baadaye.", saveProgress: "Hifadhi maendeleo kwa barua pepe", restoreProgress: "Fungua linki hii tena kurejesha maendeleo yako.", registeringOne: "Unamsajili mtu 1", registeringMany: "Unasajili watu {count}", attendee: "Mshiriki", emailAddress: "Barua pepe", forTicket: "kwa tiketi yako", select: "Chagua...", consentTitle: "Idhini ya Uchakataji wa Data", consentBody: "Je, unakubali {organizer} akusanye na kutumia taarifa zako binafsi kwa usajili, mawasiliano ya tukio, uratibu wa washiriki, na mipango ya siku ya tukio?", sendCopy: "Nitumie nakala ya majibu yangu.", submit: "Wasilisha", submitting: "Inawasilisha...", submitMany: "Wasilisha majibu {count}", closed: "Usajili umefungwa", paidPaused: "Usajili wa malipo umesitishwa", clear: "Futa fomu", passwordNotice: "Usiwahi kuwasilisha nywila au taarifa nyeti za kifedha kupitia fomu hii.", hostNotice: "Fomu hii imeundwa na mwandaaji wa tukio na kuhifadhiwa kupitia EventSlot. Huu si usajili wa akaunti ya mshiriki." },
    fr: { registrationForm: "Formulaire d'inscription", date: "Date", location: "Lieu", entryAmount: "Montant d'entree", hostedBy: "Organise par", getDirections: "Itineraire", venueDirections: "Itineraire du lieu", routePreview: "Previsualisez l'itineraire et ouvrez les indications completes si besoin.", openMap: "Ouvrir la carte", intro: "Remplissez les details ci-dessous pour reserver votre place. Vous pouvez enregistrer votre progression avec votre e-mail et continuer plus tard.", saveProgress: "Enregistrer avec l'e-mail", restoreProgress: "Rouvrez ce meme lien pour restaurer votre progression.", registeringOne: "Inscription d'une personne", registeringMany: "Inscription de {count} personnes", attendee: "Participant", emailAddress: "Adresse e-mail", forTicket: "pour votre billet", select: "Selectionner...", consentTitle: "Consentement au traitement des donnees", consentBody: "Acceptez-vous que {organizer} collecte et utilise vos informations personnelles pour l'inscription, les communications de l'evenement, la coordination des participants et l'organisation du jour de l'evenement ?", sendCopy: "M'envoyer une copie de mes reponses.", submit: "Envoyer", submitting: "Envoi...", submitMany: "Envoyer {count} reponses", closed: "Inscription fermee", paidPaused: "Inscription payante en pause", clear: "Effacer le formulaire", passwordNotice: "Ne soumettez jamais de mots de passe ou d'identifiants financiers sensibles via ce formulaire.", hostNotice: "Ce formulaire est cree par l'organisateur de l'evenement et heberge via EventSlot. Ce n'est pas une inscription de compte participant." },
    pt: { registrationForm: "Formulario de inscricao", date: "Data", location: "Local", entryAmount: "Valor de entrada", hostedBy: "Organizado por", getDirections: "Ver direcoes", venueDirections: "Direcoes do local", routePreview: "Previsualize a rota e abra as direcoes completas se necessario.", openMap: "Abrir mapa", intro: "Preencha os detalhes abaixo para garantir sua vaga. Pode guardar o progresso com seu e-mail e continuar depois.", saveProgress: "Guardar progresso com e-mail", restoreProgress: "Abra este mesmo link novamente para restaurar seu progresso.", registeringOne: "Inscrevendo 1 pessoa", registeringMany: "Inscrevendo {count} pessoas", attendee: "Participante", emailAddress: "Endereco de e-mail", forTicket: "para seu bilhete", select: "Selecionar...", consentTitle: "Consentimento para processamento de dados", consentBody: "Voce consente que {organizer} recolha e use suas informacoes pessoais para inscricao, comunicacao do evento, coordenacao de participantes e planejamento do dia do evento?", sendCopy: "Enviar-me uma copia das minhas respostas.", submit: "Enviar", submitting: "Enviando...", submitMany: "Enviar {count} respostas", closed: "Inscricoes encerradas", paidPaused: "Inscricao paga pausada", clear: "Limpar formulario", passwordNotice: "Nunca envie senhas ou credenciais financeiras sensiveis por este formulario.", hostNotice: "Este formulario e criado pelo organizador do evento e hospedado pelo EventSlot. Nao e cadastro de conta de participante." },
    es: { registrationForm: "Formulario de registro", date: "Fecha", location: "Lugar", entryAmount: "Monto de entrada", hostedBy: "Organizado por", getDirections: "Ver indicaciones", venueDirections: "Indicaciones del lugar", routePreview: "Previsualiza la ruta y abre las indicaciones completas si es necesario.", openMap: "Abrir mapa", intro: "Completa los datos abajo para asegurar tu cupo. Puedes guardar el progreso con tu correo y continuar despues.", saveProgress: "Guardar progreso con correo", restoreProgress: "Abre este mismo enlace otra vez para restaurar tu progreso.", registeringOne: "Registrando 1 persona", registeringMany: "Registrando {count} personas", attendee: "Asistente", emailAddress: "Correo electronico", forTicket: "para tu entrada", select: "Seleccionar...", consentTitle: "Consentimiento para procesamiento de datos", consentBody: "Aceptas que {organizer} recopile y use tu informacion personal para registro, comunicacion del evento, coordinacion de asistentes y planificacion del dia del evento?", sendCopy: "Enviarme una copia de mis respuestas.", submit: "Enviar", submitting: "Enviando...", submitMany: "Enviar {count} respuestas", closed: "Registro cerrado", paidPaused: "Registro pagado pausado", clear: "Limpiar formulario", passwordNotice: "Nunca envies contrasenas ni credenciales financieras sensibles mediante este formulario.", hostNotice: "Este formulario lo crea el organizador del evento y esta alojado en EventSlot. No es registro de cuenta de asistente." },
    de: { registrationForm: "Registrierungsformular", date: "Datum", location: "Ort", entryAmount: "Eintrittsbetrag", hostedBy: "Veranstaltet von", getDirections: "Route anzeigen", venueDirections: "Anfahrt zum Ort", routePreview: "Vorschau der Route anzeigen und bei Bedarf vollstaendige Wegbeschreibung oeffnen.", openMap: "Karte oeffnen", intro: "Fuellen Sie die Angaben unten aus, um Ihren Platz zu sichern. Sie koennen den Fortschritt mit Ihrer E-Mail speichern und spaeter fortfahren.", saveProgress: "Fortschritt mit E-Mail speichern", restoreProgress: "Oeffnen Sie denselben Link erneut, um Ihren Fortschritt wiederherzustellen.", registeringOne: "1 Person registrieren", registeringMany: "{count} Personen registrieren", attendee: "Teilnehmer", emailAddress: "E-Mail-Adresse", forTicket: "fuer Ihr Ticket", select: "Auswaehlen...", consentTitle: "Einwilligung zur Datenverarbeitung", consentBody: "Stimmen Sie zu, dass {organizer} Ihre personenbezogenen Daten fuer Registrierung, Event-Kommunikation, Teilnehmerkoordination und Planung am Veranstaltungstag erhebt und nutzt?", sendCopy: "Senden Sie mir eine Kopie meiner Antworten.", submit: "Absenden", submitting: "Wird gesendet...", submitMany: "{count} Antworten absenden", closed: "Registrierung geschlossen", paidPaused: "Bezahlte Registrierung pausiert", clear: "Formular loeschen", passwordNotice: "Senden Sie niemals Passwoerter oder sensible Finanzdaten ueber dieses Formular.", hostNotice: "Dieses Formular wird vom Event-Organisator erstellt und ueber EventSlot gehostet. Es ist keine Teilnehmerkonto-Registrierung." },
    ar: { registrationForm: "نموذج التسجيل", date: "التاريخ", location: "المكان", entryAmount: "قيمة الدخول", hostedBy: "بواسطة", getDirections: "احصل على الاتجاهات", venueDirections: "اتجاهات المكان", routePreview: "عاين المسار وافتح الاتجاهات الكاملة عند الحاجة.", openMap: "افتح الخريطة", intro: "املأ التفاصيل أدناه لتأكيد مكانك. يمكنك حفظ التقدم ببريدك الإلكتروني والمتابعة لاحقًا.", saveProgress: "احفظ التقدم بالبريد الإلكتروني", restoreProgress: "افتح الرابط نفسه مرة أخرى لاستعادة تقدمك.", registeringOne: "تسجيل شخص واحد", registeringMany: "تسجيل {count} أشخاص", attendee: "المشارك", emailAddress: "البريد الإلكتروني", forTicket: "لتذكرتك", select: "اختر...", consentTitle: "الموافقة على معالجة البيانات", consentBody: "هل توافق على أن يقوم {organizer} بجمع واستخدام معلوماتك الشخصية للتسجيل والتواصل بشأن الفعالية وتنسيق الحضور والتخطيط ليوم الفعالية؟", sendCopy: "أرسل لي نسخة من إجاباتي.", submit: "إرسال", submitting: "جارٍ الإرسال...", submitMany: "إرسال {count} إجابات", closed: "تم إغلاق التسجيل", paidPaused: "التسجيل المدفوع متوقف مؤقتًا", clear: "مسح النموذج", passwordNotice: "لا ترسل كلمات مرور أو بيانات مالية حساسة عبر هذا النموذج.", hostNotice: "تم إنشاء هذا النموذج بواسطة منظم الفعالية واستضافته عبر EventSlot. هذا ليس تسجيل حساب للحضور." },
    zh: { registrationForm: "报名表", date: "日期", location: "地点", entryAmount: "入场金额", hostedBy: "主办方", getDirections: "获取路线", venueDirections: "场地方向", routePreview: "预览路线，需要时打开完整导航。", openMap: "打开地图", intro: "填写以下信息以保留名额。你可以用邮箱保存进度，稍后继续。", saveProgress: "用邮箱保存进度", restoreProgress: "再次打开同一链接即可恢复已保存的进度。", registeringOne: "正在登记 1 人", registeringMany: "正在登记 {count} 人", attendee: "参加者", emailAddress: "电子邮箱", forTicket: "用于你的门票", select: "请选择...", consentTitle: "数据处理同意", consentBody: "你是否同意 {organizer} 收集并使用你的个人信息，用于报名、活动沟通、参加者协调和活动当天安排？", sendCopy: "把我的回复副本发送给我。", submit: "提交", submitting: "正在提交...", submitMany: "提交 {count} 份回复", closed: "报名已关闭", paidPaused: "付费报名已暂停", clear: "清空表单", passwordNotice: "切勿通过此表单提交密码或敏感财务凭据。", hostNotice: "此表单由活动主办方创建，并通过 EventSlot 托管。它不是参加者账号注册。" },
  } satisfies Record<SupportedLanguageCode, Record<string, string>>
  return copy[language ?? "en"] ?? copy.en
}

function isPersonalQuestion(q: EventQuestion): boolean {
  const type = (q.type || "").toLowerCase()
  if (type === "phone" || type === "email") return true
  const l = (q.label || "").toLowerCase()
  const id = (q.id || "").toLowerCase()
  if (l.includes("name") || id.includes("name")) return true
  if (l.includes("phone") || id.includes("phone")) return true
  if (l.includes("email") || id.includes("email")) return true
  if (l.includes("location") || l.includes("country") || l.includes("city")) return true
  return false
}

export default function RegistrationForm({ event, showBranding = false, maxAttendees = 3, compactHeader = false }: EventProps) {
  const [attendees, setAttendees] = useState<AttendeeAnswers[]>([emptyAnswers(event.questions)])
  const [loading, setLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState("")
  const [consentDataProcessing, setConsentDataProcessing] = useState(false)
  const [consentTransactional, setConsentTransactional] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [sendResponseCopy, setSendResponseCopy] = useState(false)

  // Guided Step State: 0 = welcome, 1 = personal, 2 = event questions (if any), 3 = review
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  // Duplicate detection
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null)
  const [pendingPayload, setPendingPayload] = useState<PendingPayload | null>(null)

  // Waitlist email capture (shown when event has no email question)
  const [waitlistEmails, setWaitlistEmails] = useState<Record<string, string>>({})
  const [waitlistEmailSaving, setWaitlistEmailSaving] = useState<Record<string, boolean>>({})
  const [waitlistEmailSaved, setWaitlistEmailSaved] = useState<Record<string, boolean>>({})
  const [waitlistEmailErrors, setWaitlistEmailErrors] = useState<Record<string, string>>({})

  // Base email inputs — always collected when event has no email question
  const [baseEmails, setBaseEmails] = useState<string[]>([""])
  const [otherCustomAnswers, setOtherCustomAnswers] = useState<Record<string, string>>({})
  const [registrationSource, setRegistrationSource] = useState<string>("unknown")
  const [registrationRefCode, setRegistrationRefCode] = useState<string | undefined>(undefined)
  const [registrationUtmSource, setRegistrationUtmSource] = useState<string | undefined>(undefined)
  const [selectedTierId] = useState<string>(event.ticketTiers?.[0]?.id ?? "")
  const [registrationMode, setRegistrationMode] = useState<"individual" | "group">("individual")
  const [orgName, setOrgName] = useState("")
  const [orgType, setOrgType] = useState("COMPANY")
  const [orgContactName, setOrgContactName] = useState("")
  const [orgContactEmail, setOrgContactEmail] = useState("")
  const [orgContactPhone, setOrgContactPhone] = useState("")
  const [groupSlots, setGroupSlots] = useState(5)
  const [groupSubmitting, setGroupSubmitting] = useState(false)
  const [groupResult, setGroupResult] = useState<any>(null)
  const [groupError, setGroupError] = useState("")
  const [groupFieldErrors, setGroupFieldErrors] = useState<Record<string, string>>({})
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>({})
  const [groupCopied, setGroupCopied] = useState(false)
  const [paymentMethod] = useState<"mpesa" | "card">("mpesa")
  const [mpesaPhone] = useState("")
  const [paidCheckout, setPaidCheckout] = useState<PaidCheckoutResponse | null>(null)
  const [paymentPolling, setPaymentPolling] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({})
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({})
  const [publicTranslation, setPublicTranslation] = useState<PublicEventTranslation | null>(null)
  const [draftEmail, setDraftEmail] = useState("")
  const [draftState, setDraftState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle")
  const [draftMessage, setDraftMessage] = useState("")
  const [restoredDraftEmail, setRestoredDraftEmail] = useState("")
  const [deadlineExpired, setDeadlineExpired] = useState(() => {
    if (!event.deadline) return false
    return new Date(event.deadline).getTime() <= Date.now()
  })

  const recurringWindow = event.isRecurring
    ? getRegistrationWindowStatus(event)
    : null
  const windowClosed = Boolean(recurringWindow && !recurringWindow.isOpen)
  const effectiveEventDate = event.isRecurring
    ? computeNextOccurrenceDate({ eventDate: event.eventDate, isRecurring: event.isRecurring, recurrenceFrequency: event.recurrenceFrequency, recurrenceDayOfWeek: event.recurrenceDayOfWeek })
    : event.eventDate
  const effectiveEventEndAt = event.isRecurring && effectiveEventDate
    ? computeOccurrenceEnd(new Date(effectiveEventDate), event.eventDate, event.eventEndAt)
    : event.eventEndAt
  const registrationClosed = deadlineExpired || event.status === "closed" || windowClosed
  const activeTicketTiers = Array.isArray(event.ticketTiers) ? event.ticketTiers.filter(tier => tier.priceKes > 0) : []
  const tierEntryLabel = event.isPaid && activeTicketTiers.length > 0
    ? activeTicketTiers.length === 1
      ? `${activeTicketTiers[0].currency || "KSh"} ${activeTicketTiers[0].priceKes.toLocaleString()}`
      : activeTicketTiers
          .map(tier => `${tier.name}: ${tier.currency || "KSh"} ${tier.priceKes.toLocaleString()}`)
          .join(" / ")
    : null
  const entryLabel = event.entryFeeLabel?.trim() || tierEntryLabel
  const formCopy = getFormCopy(publicTranslation?.targetLanguage ?? null)
  const displayTitle = publicTranslation?.title || event.title
  const displayLocation = publicTranslation?.location || event.location
  const displayOrganizerName = publicTranslation?.organizerName || event.organizerName
  const displayEntryLabel = publicTranslation?.entryFeeLabel || entryLabel
  const consentRequired = event.attendeeConsentEnabled !== false
  const consentBody = event.attendeeConsentText?.trim() || formCopy.consentBody.replace("{organizer}", displayOrganizerName ?? "the organiser")

  const translatedQuestionById = new Map((publicTranslation?.questions ?? []).map((question) => [question.id, question]))
  const displayQuestions = event.questions.map((question) => {
    const translatedQuestion = translatedQuestionById.get(question.id)
    if (!translatedQuestion) return question
    return {
      ...question,
      label: translatedQuestion.label || question.label,
      options: question.options,
    }
  })

  const getOptionLabel = (question: EventQuestion, option: string, optionIndex: number) => {
    const translatedQuestion = translatedQuestionById.get(question.id)
    if (!translatedQuestion?.options || translatedQuestion.options.length !== question.options?.length) return option
    return translatedQuestion.options[optionIndex] || option
  }

  // Dynamic step determination
  const { personalQuestions, eventQuestions } = useMemo(() => {
    const personal: EventQuestion[] = []
    const custom: EventQuestion[] = []

    displayQuestions.forEach(q => {
      if (isPersonalQuestion(q)) {
        personal.push(q)
      } else {
        custom.push(q)
      }
    })

    if (personal.length === 0 && custom.length > 0) {
      personal.push(custom.shift()!)
    }

    return { personalQuestions: personal, eventQuestions: custom }
  }, [displayQuestions])

  const steps = useMemo<RegistrationStep[]>(() => {
    const list: RegistrationStep[] = [
      { id: "welcome", title: "Welcome", shortLabel: "Welcome" },
      { id: "personal", title: "Personal Details", shortLabel: "Details" },
    ]
    if (eventQuestions.length > 0) {
      list.push({ id: "questions", title: "Event Questions", shortLabel: "Questions" })
    }
    list.push({ id: "review", title: "Review & Confirm", shortLabel: "Review" })
    return list
  }, [eventQuestions.length])

  const isLastStep = currentStepIndex === steps.length - 1

  useEffect(() => {
    const eventName = `eventslot:public-translation:${event.slug}`
    const handleTranslation = (customEvent: Event) => {
      const detail = (customEvent as CustomEvent<PublicEventTranslation | null>).detail
      setPublicTranslation(detail ?? null)
    }
    window.addEventListener(eventName, handleTranslation)
    return () => window.removeEventListener(eventName, handleTranslation)
  }, [event.slug])

  useEffect(() => {
    const sourceKey = `event_source_${event.slug}`
    const refKey = `event_ref_${event.slug}`
    const utmKey = `event_utm_source_${event.slug}`

    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")?.trim() || ""
    const utmSource = params.get("utm_source")?.trim() || ""
    const referrer = document.referrer || ""

    let source = "unknown"
    if (ref) {
      source = "referral"
    } else if (!referrer) {
      source = "direct"
    } else {
      try {
        const refHost = new URL(referrer).host
        source = refHost.includes("eventslot") ? "shared" : "unknown"
      } catch {
        source = "unknown"
      }
    }

    sessionStorage.setItem(sourceKey, source)
    if (ref) sessionStorage.setItem(refKey, ref)
    if (utmSource) sessionStorage.setItem(utmKey, utmSource)

    const storedSource = sessionStorage.getItem(sourceKey) || source
    const storedRef = sessionStorage.getItem(refKey) || undefined
    const storedUtmSource = sessionStorage.getItem(utmKey) || undefined

    setRegistrationSource(storedSource)
    setRegistrationRefCode(storedRef)
    setRegistrationUtmSource(storedUtmSource)
  }, [event.slug])

  useEffect(() => {
    if (!paidCheckout?.orderId) return

    let cancelled = false
    setPaymentPolling(true)

    const poll = async () => {
      try {
        const res = await fetch(`/api/paid-events/orders/${paidCheckout.orderId}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok || cancelled) return

        if (data.status === "PAID" && data.confirmationCode) {
          window.location.href = `/register/success/${data.confirmationCode}`
          return
        }

        if (data.status === "EXPIRED") {
          setError("Your payment hold expired. Please choose your ticket tier again.")
          setPaidCheckout(null)
          setPaymentPolling(false)
          return
        }

        if (data.status === "FAILED" || data.status === "CANCELLED") {
          setError("Payment was not completed. Please try again.")
          setPaidCheckout(null)
          setPaymentPolling(false)
          return
        }

        window.setTimeout(poll, 4000)
      } catch {
        if (!cancelled) {
          window.setTimeout(poll, 5000)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      setPaymentPolling(false)
    }
  }, [paidCheckout])

  const hasEmailQuestion = event.questions.some(q => q.type === 'email')
  const emailQuestion = event.questions.find((question) => question.type === "email")
  const fieldClassName = "mt-1.5 w-full rounded-[12px] border px-3.5 py-3 text-[0.9rem] transition placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C8F55A]"
  const subtleLabelClassName = "mb-1.5 block text-[0.74rem] font-semibold tracking-[0.06em] uppercase"
  const fieldStyle = {
    background: "var(--bg-input)",
    borderColor: "color-mix(in srgb, var(--text-primary) 14%, transparent)",
    color: "var(--text-primary)",
    boxShadow: "0 0 0 0 transparent",
  } satisfies React.CSSProperties
  const subtleLabelStyle = { color: "var(--text-secondary)" } satisfies React.CSSProperties
  const questionCardStyle = {
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
    background: "color-mix(in srgb, var(--surface) 94%, white 6%)",
  } satisfies React.CSSProperties
  const mutedCardStyle = {
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
    background: "color-mix(in srgb, var(--surface) 88%, transparent)",
  } satisfies React.CSSProperties
  const resultCardStyle = {
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
    background: "color-mix(in srgb, var(--surface) 96%, white 4%)",
  } satisfies React.CSSProperties
  const softPanelStyle = {
    background: "color-mix(in srgb, var(--surface) 90%, transparent)",
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
  } satisfies React.CSSProperties

  const currentEmailFromAnswers = emailQuestion ? attendees[0]?.[emailQuestion.id]?.trim() ?? "" : ""
  const effectiveDraftEmail = (draftEmail || currentEmailFromAnswers || baseEmails[0] || "").trim().toLowerCase()

  useEffect(() => {
    try {
      const lastEmail = window.localStorage.getItem(`eventslot-draft-email:${event.slug}`) ?? ""
      if (lastEmail) setDraftEmail(lastEmail)
    } catch {
      // Ignore storage issues.
    }
  }, [event.slug])

  useEffect(() => {
    if (!hasEmailQuestion && draftEmail && !baseEmails[0]) {
      setBaseEmails((current) => {
        const next = [...current]
        next[0] = draftEmail
        return next
      })
    }
  }, [baseEmails, draftEmail, hasEmailQuestion])

  useEffect(() => {
    if (hasEmailQuestion && currentEmailFromAnswers && currentEmailFromAnswers !== draftEmail) {
      setDraftEmail(currentEmailFromAnswers)
    }
  }, [currentEmailFromAnswers, draftEmail, hasEmailQuestion])

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveDraftEmail)) return
    if (restoredDraftEmail === effectiveDraftEmail) return

    let cancelled = false
    setDraftState("loading")
    setDraftMessage("Checking for saved progress...")

    void fetch(`/api/register/draft?eventSlug=${encodeURIComponent(event.slug)}&email=${encodeURIComponent(effectiveDraftEmail)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || cancelled) return
        if (!data.draft) {
          setRestoredDraftEmail(effectiveDraftEmail)
          setDraftState("idle")
          setDraftMessage("")
          return
        }

        const draftAnswers = Array.isArray(data.draft.answers) ? data.draft.answers : []
        const nextAttendees = draftAnswers
          .map((entry: Record<string, string>) => {
            const answerMap = emptyAnswers(event.questions)
            for (const [key, value] of Object.entries(entry ?? {})) {
              answerMap[key] = typeof value === "string" ? value : ""
            }
            return answerMap
          })
          .filter((entry: AttendeeAnswers) => Object.values(entry).some(Boolean))

        if (nextAttendees.length > 0) {
          setAttendees(nextAttendees)
        }
        if (Array.isArray(data.draft.baseEmails) && data.draft.baseEmails.length > 0) {
          setBaseEmails(data.draft.baseEmails.map((value: unknown) => (typeof value === "string" ? value : "")))
        }
        setConsentDataProcessing(Boolean(data.draft.consentDataProcessing))
        setConsentTransactional(Boolean(data.draft.consentTransactional))
        setConsentMarketing(Boolean(data.draft.consentMarketing))
        setSendResponseCopy(Boolean(data.draft.sendResponseCopy))
        setRestoredDraftEmail(effectiveDraftEmail)
        setDraftState("saved")
        setDraftMessage("Saved progress restored.")
      })
      .catch(() => {
        if (!cancelled) {
          setDraftState("error")
          setDraftMessage("We could not load saved progress right now.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [effectiveDraftEmail, event.questions, event.slug, restoredDraftEmail])

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveDraftEmail)) return
    if (bulkResult) return

    try {
      window.localStorage.setItem(`eventslot-draft-email:${event.slug}`, effectiveDraftEmail)
    } catch {
      // Ignore storage issues.
    }

    const timeout = window.setTimeout(() => {
      setDraftState("saving")
      setDraftMessage("Saving your progress...")
      void fetch("/api/register/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: event.slug,
          email: effectiveDraftEmail,
          answers: attendees,
          attendeeCount: attendees.length,
          baseEmails,
          consentDataProcessing: consentRequired ? consentDataProcessing : true,
          consentTransactional: true,
          consentMarketing: false,
          sendResponseCopy,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("save_failed")
          }
          setDraftState("saved")
          setDraftMessage("Progress saved.")
        })
        .catch(() => {
          setDraftState("error")
          setDraftMessage("We could not save your progress.")
        })
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [
    attendees,
    baseEmails,
    bulkResult,
    consentDataProcessing,
    consentMarketing,
    consentTransactional,
    effectiveDraftEmail,
    event.slug,
    sendResponseCopy,
  ])

  const canAddMore = !event.isPaid && !registrationClosed && attendees.length < maxAttendees
  const isSubmitBlocked = loading || registrationClosed || event.isPaid

  function addAttendee() {
    if (!canAddMore) return
    setAttendees(a => [...a, emptyAnswers(event.questions)])
    setBaseEmails(e => [...e, ""])
  }

  function removeAttendee(index: number) {
    setAttendees(a => a.filter((_, i) => i !== index))
    setBaseEmails(e => e.filter((_, i) => i !== index))
  }

  function handleChange(attendeeIndex: number, qId: string, value: string) {
    setAttendees(a => {
      const next = [...a]
      next[attendeeIndex] = { ...next[attendeeIndex], [qId]: value }
      return next
    })
  }

  async function handleFileUpload(attendeeIndex: number, qId: string, file: File | null) {
    const key = `${attendeeIndex}:${qId}`
    setFileErrors(prev => ({ ...prev, [key]: "" }))

    if (!file) {
      handleChange(attendeeIndex, qId, "")
      return
    }

    const payload = new FormData()
    payload.set("eventSlug", event.slug)
    payload.set("questionId", qId)
    payload.set("file", file)

    setUploadingFiles(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch("/api/register/upload", {
        method: "POST",
        body: payload,
      })
      const data = await res.json() as { file?: UploadedFileAnswer; error?: string }
      if (!res.ok || !data.file) {
        setFileErrors(prev => ({ ...prev, [key]: data.error ?? "Upload failed. Please try again." }))
        return
      }

      handleChange(attendeeIndex, qId, JSON.stringify(data.file))
    } catch {
      setFileErrors(prev => ({ ...prev, [key]: "Upload failed. Please check your connection." }))
    } finally {
      setUploadingFiles(prev => ({ ...prev, [key]: false }))
    }
  }

  function validateCurrentStep(targetStepIndex: number): boolean {
    const targetStep = steps[targetStepIndex]
    const qErrors: Record<string, string> = {}
    let firstErrorElementId: string | null = null

    if (targetStep.id === "personal") {
      for (let i = 0; i < attendees.length; i++) {
        for (const q of personalQuestions) {
          if (!q.required) continue
          const answer = attendees[i][q.id] || ""
          const hasValue = q.type === "checkbox"
            ? parseCheckboxValue(answer).length > 0
            : answer.trim().length > 0
          if (!hasValue) {
            const key = `${i}:${q.id}`
            qErrors[key] = `Please fill in "${q.label}".`
            if (!firstErrorElementId) firstErrorElementId = `q-input-${i}-${q.id}`
          }
        }
        if (!hasEmailQuestion && baseEmails[i] !== undefined) {
          const emailVal = baseEmails[i]?.trim() || ""
          if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
            qErrors[`${i}:baseEmail`] = "Please enter a valid email address."
            if (!firstErrorElementId) firstErrorElementId = `base-email-${i}`
          }
        }
      }
    } else if (targetStep.id === "questions") {
      for (let i = 0; i < attendees.length; i++) {
        for (const q of eventQuestions) {
          if (!q.required) continue
          if (q.condition && attendees[i][q.condition.questionId] !== q.condition.value) continue

          const answer = attendees[i][q.id] || ""
          const hasValue = q.type === "checkbox"
            ? parseCheckboxValue(answer).length > 0
            : answer.trim().length > 0
          if (!hasValue) {
            const key = `${i}:${q.id}`
            qErrors[key] = `Please fill in "${q.label}".`
            if (!firstErrorElementId) firstErrorElementId = `q-input-${i}-${q.id}`
          }
        }
      }
    }

    if (Object.keys(qErrors).length > 0) {
      setQuestionErrors(prev => ({ ...prev, ...qErrors }))
      setError("Please complete the required fields highlighted below.")
      if (firstErrorElementId) {
        const el = document.getElementById(firstErrorElementId)
        if (el) {
          el.scrollIntoView?.({ behavior: "smooth", block: "center" })
          el.focus?.()
        }
      }
      return false
    }

    setQuestionErrors({})
    setError("")
    return true
  }

  function handleNextStep() {
    if (currentStepIndex === 0) {
      setCurrentStepIndex(1)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    const isValid = validateCurrentStep(currentStepIndex)
    if (!isValid) return

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  function handlePrevStep() {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!orgName.trim()) {
      errors.orgName = "Organization or group name is required."
    }
    if (!groupSlots || Number(groupSlots) < 1) {
      errors.groupSlots = "Please reserve at least 1 slot."
    } else if (Number(groupSlots) > 500) {
      errors.groupSlots = "Maximum group allocation is 500 seats."
    }
    if (!orgContactName.trim()) {
      errors.orgContactName = "Primary contact person's name is required."
    }
    if (!orgContactEmail.trim()) {
      errors.orgContactEmail = "Contact email address is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgContactEmail.trim())) {
      errors.orgContactEmail = "Please enter a valid email address (e.g. name@company.com)."
    }
    if (!orgContactPhone.trim()) {
      errors.orgContactPhone = "Contact phone number is required."
    } else if (orgContactPhone.trim().length < 9) {
      errors.orgContactPhone = "Please enter a valid phone number (at least 9 digits)."
    }

    if (Object.keys(errors).length > 0) {
      setGroupFieldErrors(errors)
      setGroupError("Please fill in the required fields highlighted in red below.")
      const firstKey = Object.keys(errors)[0]
      const el = document.getElementById(`gb-${firstKey}`)
      if (el) {
        el.scrollIntoView?.({ behavior: "smooth", block: "center" })
        el.focus?.()
      }
      return
    }

    setGroupFieldErrors({})
    setGroupSubmitting(true)
    setGroupError("")

    try {
      const res = await fetch(`/api/events/${event.slug}/group-booking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          orgType,
          contactName: orgContactName.trim(),
          contactEmail: orgContactEmail.trim(),
          contactPhone: orgContactPhone.trim(),
          totalSlots: Number(groupSlots),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.field) {
          setGroupFieldErrors({ [json.field]: json.error })
          const el = document.getElementById(`gb-${json.field}`)
          if (el) {
            el.scrollIntoView?.({ behavior: "smooth", block: "center" })
            el.focus?.()
          }
        }
        throw new Error(json.error || "Failed to create group booking")
      }
      setGroupResult(json.booking)
    } catch (err: any) {
      setGroupError(err.message || "Failed to create group booking")
    } finally {
      setGroupSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")

    if (registrationClosed) {
      setError("Registration has closed.")
      return
    }
    if (consentRequired && !consentDataProcessing) {
      setError("Please confirm the data-processing consent before submitting.")
      return
    }

    // Client-side required field validation across all questions
    const qErrors: Record<string, string> = {}
    let firstErrorElementId: string | null = null

    for (let i = 0; i < attendees.length; i++) {
      for (const q of event.questions) {
        if (!q.required) continue
        const answer = attendees[i][q.id] || ""
        const hasValue = q.type === "checkbox"
          ? parseCheckboxValue(answer).length > 0
          : answer.trim().length > 0
        if (!hasValue) {
          const key = `${i}:${q.id}`
          qErrors[key] = `Please fill in "${q.label}".`
          if (!firstErrorElementId) {
            firstErrorElementId = `q-input-${i}-${q.id}`
          }
        }
      }
      if (!hasEmailQuestion && baseEmails[i] !== undefined) {
        const emailVal = baseEmails[i]?.trim() || ""
        if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          qErrors[`${i}:baseEmail`] = "Please enter a valid email address."
          if (!firstErrorElementId) firstErrorElementId = `base-email-${i}`
        }
      }
    }

    if (Object.keys(qErrors).length > 0) {
      setQuestionErrors(qErrors)
      setError("Please fill in the required fields highlighted in red.")
      if (firstErrorElementId) {
        const el = document.getElementById(firstErrorElementId)
        if (el) {
          el.scrollIntoView?.({ behavior: "smooth", block: "center" })
          el.focus?.()
        }
      }
      return
    }
    setQuestionErrors({})

    if (event.isPaid) {
      setError(getBillingNoticeCopy("paidEventRegistration").error)
      return
    }

    setLoading(true)
    try {
      const attendeesPayload = attendees.map((form, i) => ({
        answers: event.questions.map(q => ({ questionId: q.id, value: form[q.id] || "" })),
        ...((!hasEmailQuestion && baseEmails[i]) ? { baseEmail: baseEmails[i] } : {}),
      }))

      if (event.isPaid) {
        const res = await fetch("/api/paid-events/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            ticketTierId: selectedTierId,
            attendee: attendeesPayload[0],
            consentDataProcessing: consentRequired ? consentDataProcessing : true,
            consentTransactional: true,
            consentMarketing: false,
            sendResponseCopy,
            paymentMethod,
            mpesaPhone,
            source: registrationSource,
            refCode: registrationRefCode,
            utmSource: registrationUtmSource,
          }),
        })
        const data = await res.json()

        if (data.success && data.url) {
          window.location.href = data.url
        } else if (data.success && data.checkoutRequestId) {
          setPaidCheckout(data)
        } else if (data.success && data.results) {
          setBulkResult(data)
        } else {
          setError(data.error || "Unable to start payment.")
        }
      } else {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            attendees: attendeesPayload,
            consentDataProcessing: consentRequired ? consentDataProcessing : true,
            consentTransactional: true,
            consentMarketing: false,
            sendResponseCopy,
            source: registrationSource,
            refCode: registrationRefCode,
            utmSource: registrationUtmSource,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setBulkResult(data)
        } else if (data.duplicate) {
          setDuplicateInfo({
            attendeeIndex: data.attendeeIndex ?? 0,
            registrationNumber: data.existing?.registrationNumber ?? null,
            name: data.existing?.name ?? "",
            maskedPhone: data.existing?.maskedPhone ?? "",
          })
          setPendingPayload({
            eventSlug: event.slug,
            attendeesPayload,
            consentDataProcessing: consentRequired ? consentDataProcessing : true,
            consentTransactional: true,
            consentMarketing: false,
            sendResponseCopy,
            source: registrationSource,
            refCode: registrationRefCode,
            utmSource: registrationUtmSource,
          })
        } else {
          setError(data.error || "Registration failed.")
        }
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleForceRegister = async () => {
    if (!pendingPayload) return
    setLoading(true)
    setDuplicateInfo(null)
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingPayload,
          attendees: pendingPayload.attendeesPayload,
          forceDuplicate: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBulkResult(data)
        setPendingPayload(null)
      } else {
        setError(data.error || "Registration failed.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const saveWaitlistEmail = async (registrationId: string, email: string) => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: "Enter a valid email address." }))
      return
    }

    setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: "" }))
    setWaitlistEmailSaving(prev => ({ ...prev, [registrationId]: true }))
    try {
      const res = await fetch(`/api/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeEmail: trimmedEmail }),
      })
      if (res.ok) {
        setWaitlistEmailSaved(prev => ({ ...prev, [registrationId]: true }))
      } else {
        const data = await res.json().catch(() => ({}))
        setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: data.error || "Unable to save your email right now." }))
      }
    } catch {
      setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: "Network error. Please try again." }))
    } finally {
      setWaitlistEmailSaving(prev => ({ ...prev, [registrationId]: false }))
    }
  }

  const clearForm = async () => {
    const emailToClear = effectiveDraftEmail
    setAttendees([emptyAnswers(event.questions)])
    setBaseEmails([""])
    setConsentDataProcessing(false)
    setConsentTransactional(false)
    setConsentMarketing(false)
    setSendResponseCopy(false)
    setDraftEmail("")
    setError("")
    setDuplicateInfo(null)
    setPendingPayload(null)
    setCurrentStepIndex(0)
    try {
      window.localStorage.removeItem(`eventslot-draft-email:${event.slug}`)
    } catch {
      // Ignore storage issues.
    }
    if (!emailToClear) return

    try {
      await fetch(`/api/register/draft?eventSlug=${encodeURIComponent(event.slug)}&email=${encodeURIComponent(emailToClear)}`, {
        method: "DELETE",
      })
      setDraftState("idle")
      setDraftMessage("Saved progress cleared.")
      setRestoredDraftEmail("")
    } catch {
      setDraftState("error")
      setDraftMessage("We cleared the form, but the saved draft could not be removed.")
    }
  }

  const renderQuestionInput = (q: EventQuestion, attendeeIndex: number) => {
    const qKey = `${attendeeIndex}:${q.id}`
    const qError = questionErrors[qKey]
    const elementId = `q-input-${attendeeIndex}-${q.id}`
    const activeFieldStyle = qError
      ? { ...fieldStyle, borderColor: "#EF4444", boxShadow: "0 0 0 1px #EF4444" }
      : fieldStyle

    const isNameField = /name/i.test(q.label) || /name/i.test(q.id)

    return (
      <div key={q.id} className="space-y-1.5">
        <label
          htmlFor={elementId}
          className={subtleLabelClassName}
          style={{ ...subtleLabelStyle, color: qError ? "#EF4444" : subtleLabelStyle?.color }}
        >
          {q.label}{q.required && <span className="text-[#C8F55A]"> *</span>}
        </label>

        {q.type === "text" && (
          <input
            id={elementId}
            type="text"
            className={fieldClassName}
            style={activeFieldStyle}
            required={q.required}
            placeholder={isNameField ? "John Doe" : undefined}
            autoComplete={isNameField ? "name" : undefined}
            value={attendees[attendeeIndex]?.[q.id] || ""}
            onChange={e => {
              handleChange(attendeeIndex, q.id, e.target.value)
              if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
            }}
          />
        )}

        {q.type === "email" && (
          <input
            id={elementId}
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="john.doe@example.com"
            className={fieldClassName}
            style={activeFieldStyle}
            required={q.required}
            value={attendees[attendeeIndex]?.[q.id] || ""}
            onChange={e => {
              handleChange(attendeeIndex, q.id, e.target.value)
              if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
            }}
          />
        )}

        {q.type === "phone" && (
          <InternationalPhoneInput
            id={elementId}
            value={attendees[attendeeIndex]?.[q.id] || ""}
            required={q.required}
            hasError={Boolean(qError)}
            placeholder="712 345 678"
            onChange={val => {
              handleChange(attendeeIndex, q.id, val)
              if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
            }}
          />
        )}

        {q.type === "textarea" && (
          <textarea
            id={elementId}
            rows={3}
            className={`${fieldClassName} resize-y min-h-[96px]`}
            style={activeFieldStyle}
            required={q.required}
            placeholder="Share your thoughts or answer here..."
            value={attendees[attendeeIndex]?.[q.id] || ""}
            onChange={e => {
              handleChange(attendeeIndex, q.id, e.target.value)
              if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
            }}
          />
        )}

        {q.type === "number" && (
          <input
            id={elementId}
            type="number"
            inputMode="numeric"
            className={fieldClassName}
            style={activeFieldStyle}
            required={q.required}
            value={attendees[attendeeIndex]?.[q.id] || ""}
            onChange={e => {
              handleChange(attendeeIndex, q.id, e.target.value)
              if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
            }}
          />
        )}

        {q.type === "file" && (() => {
          const uploadKey = `${attendeeIndex}:${q.id}`
          const uploadedFile = parseFileAnswer(attendees[attendeeIndex]?.[q.id])
          return (
            <div className="mt-1 rounded-[14px] p-4 transition-all" style={qError ? { ...mutedCardStyle, border: "1px solid #EF4444" } : mutedCardStyle}>
              <div className="flex flex-col items-center justify-center text-center p-3 border border-dashed rounded-[12px] border-[color-mix(in_srgb,var(--text-primary)_18%,transparent)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-[var(--accent)]" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <label htmlFor={elementId} className="cursor-pointer text-[0.85rem] font-semibold text-[var(--accent)] hover:underline">
                  Choose a file or drag here
                </label>
                <input
                  id={elementId}
                  type="file"
                  required={q.required && !uploadedFile}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  className="sr-only"
                  disabled={uploadingFiles[uploadKey]}
                  onChange={e => {
                    void handleFileUpload(attendeeIndex, q.id, e.target.files?.[0] ?? null)
                    if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
                  }}
                />
                <p className="mt-1.5 text-[0.74rem] text-[var(--text-muted)]">
                  Image, PDF, Word, Excel, or text (Max 10 MB)
                </p>
              </div>

              {uploadingFiles[uploadKey] && (
                <div className="mt-3 flex items-center gap-2 text-[0.78rem] text-[var(--accent)]">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  <span>Uploading file...</span>
                </div>
              )}
              {fileErrors[uploadKey] && (
                <p className="mt-2 text-[0.78rem] text-[var(--error)]">
                  {fileErrors[uploadKey]}
                </p>
              )}
              {uploadedFile && (
                <div className="mt-3 flex items-center justify-between rounded-[12px] border px-3.5 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 14%, transparent)", background: "var(--surface)" }}>
                  <div className="truncate">
                    <a href={uploadedFile.url} target="_blank" rel="noopener noreferrer" className="text-[0.84rem] font-semibold text-[var(--accent)] hover:underline truncate block">
                      {uploadedFile.name}
                    </a>
                    <p className="text-[0.72rem] text-[var(--text-muted)]">
                      {uploadedFile.type || "Document"} • {formatFileSize(uploadedFile.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleChange(attendeeIndex, q.id, "")}
                    className="ml-2 text-xs text-[var(--text-muted)] hover:text-red-400 p-1"
                    title="Remove file"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {q.type === "select" && (
          <div className="space-y-2">
            <select
              id={elementId}
              className={fieldClassName}
              style={activeFieldStyle}
              required={q.required}
              value={attendees[attendeeIndex]?.[q.id] || ""}
              onChange={e => {
                handleChange(attendeeIndex, q.id, e.target.value)
                if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
              }}
            >
              <option value="" className="bg-[#141414] text-[#F0EDE6]">{formCopy.select}</option>
              {q.options?.map((opt, optionIndex) => (
                <option key={opt} value={opt} className="bg-[#141414] text-[#F0EDE6]">
                  {getOptionLabel(q, opt, optionIndex)}
                </option>
              ))}
            </select>

            {q.optionLimits && Object.keys(q.optionLimits).length > 0 && (
              <p className="text-[0.72rem] text-[var(--text-muted)]">
                Some positions have limited slots and may close once full.
              </p>
            )}
          </div>
        )}

        {q.type === "checkbox" && (
          <div className="mt-1 space-y-2 rounded-[14px] p-3" style={qError ? { ...mutedCardStyle, border: "1px solid #EF4444" } : mutedCardStyle}>
            {q.options?.map((opt, optionIndex) => {
              const selectedValues = parseCheckboxValue(attendees[attendeeIndex]?.[q.id])
              const isChecked = selectedValues.includes(opt)
              const isOtherOption = /^(other|nyingine)/i.test(opt.trim())
              const otherKey = `${attendeeIndex}:${q.id}`
              return (
                <div key={`${q.id}-${opt}`} className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2.5 text-[0.86rem] p-1.5 rounded-[8px] hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] transition" style={{ color: "var(--text-primary)" }}>
                    <input
                      id={elementId}
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        const nextValues = e.target.checked
                          ? (q.allowMultiple ? [...selectedValues, opt] : [opt])
                          : selectedValues.filter(value => value !== opt)
                        handleChange(attendeeIndex, q.id, serializeCheckboxValue(nextValues))
                        if (qError) setQuestionErrors(prev => ({ ...prev, [qKey]: "" }))
                      }}
                      className="h-4 w-4 rounded text-[#C8F55A] focus:ring-[#C8F55A]"
                      style={{ borderColor: "color-mix(in srgb, var(--text-primary) 20%, transparent)", background: "var(--bg-input)" }}
                    />
                    <span>{getOptionLabel(q, opt, optionIndex)}</span>
                  </label>
                  {isChecked && isOtherOption && (
                    <div className="pl-6 pt-1">
                      <input
                        type="text"
                        placeholder="Please specify your answer..."
                        value={otherCustomAnswers[otherKey] ?? ""}
                        onChange={e => {
                          const customVal = e.target.value
                          setOtherCustomAnswers(prev => ({ ...prev, [otherKey]: customVal }))
                        }}
                        className="w-full rounded-[8px] border px-3 py-2 text-[0.82rem] focus:outline-none focus:ring-1 focus:ring-[#C8F55A]"
                        style={{ borderColor: "var(--border-emphasis)", background: "var(--surface)", color: "var(--text-primary)" }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
            {q.required && parseCheckboxValue(attendees[attendeeIndex]?.[q.id]).length === 0 && (
              <p className="text-[0.72rem] text-[var(--text-muted)]">Select at least one option.</p>
            )}
            {q.optionLimits && Object.keys(q.optionLimits).length > 0 && (
              <p className="text-[0.72rem] text-[var(--text-muted)]">Some options have limited slots and may stop accepting selections once full.</p>
            )}
          </div>
        )}

        {qError && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <span>⚠️</span>
            <span>{qError}</span>
          </p>
        )}
      </div>
    )
  }

  if (paidCheckout) {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        <div
          className="rounded-[16px] p-8 text-center"
          style={{
            border: "1px solid rgba(255,184,77,0.24)",
            background: "color-mix(in srgb, var(--surface) 94%, rgba(255,184,77,0.06) 6%)",
          }}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(255,184,77,0.3)] bg-[rgba(255,184,77,0.08)]">
            <span className="text-[#FFB84D] text-xl">₿</span>
          </div>
          <h2 className="text-[1.5rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
            Complete payment on your phone
          </h2>
          <p className="mt-3 text-[0.9rem]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
            We sent an M-Pesa STK push for <strong style={{ color: "var(--text-primary)" }}>KES {paidCheckout.amountKes.toLocaleString()}</strong> for the <strong style={{ color: "var(--text-primary)" }}>{paidCheckout.ticketTierName}</strong> ticket.
          </p>
          <p className="mt-3 text-[0.82rem] text-[#C8F55A]" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {paidCheckout.customerMessage}
          </p>
          <p className="mt-5 text-[0.78rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
            {paymentPolling ? "Waiting for payment confirmation..." : "Checking payment status..."}
          </p>
        </div>
      </div>
    )
  }

  if (groupResult) {
    return (
      <div className="mx-auto w-full max-w-[560px]">
        <div className="rounded-[20px] border p-6 sm:p-8 space-y-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="inline-block rounded-full px-3 py-1 text-[0.72rem] font-bold tracking-wider uppercase" style={{ background: "color-mix(in srgb, var(--accent) 15%, transparent)", color: "var(--accent)" }}>
              Organization Reservation Confirmed
            </span>
            <h2 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
              {groupResult.orgName}
            </h2>
            <p className="text-[0.92rem]" style={{ color: "var(--text-secondary)" }}>
              You have successfully reserved <strong style={{ color: "var(--accent)" }}>{groupResult.totalSlots} slots</strong> for <strong style={{ color: "var(--text-primary)" }}>{event.title}</strong>.
            </p>
          </div>

          <div className="rounded-[12px] border p-4 text-[0.82rem] flex items-start gap-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <span className="text-lg">📧</span>
            <div>
              <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                Confirmation &amp; Access Link Emailed
              </p>
              <p className="mt-0.5" style={{ color: "var(--text-secondary)" }}>
                We sent your reservation confirmation, management links, and instructions to <strong style={{ color: "var(--text-primary)" }}>{orgContactEmail}</strong>.
              </p>
            </div>
          </div>

          <div className="rounded-[16px] border p-5 text-center space-y-3" style={{ borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)", background: "color-mix(in srgb, var(--accent) 6%, var(--surface))" }}>
            <p className="text-[0.85rem] font-semibold" style={{ color: "var(--text-primary)" }}>
              Step 1: Open your Delegation Manager Portal
            </p>
            <p className="text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
              Assign attendee names, update contacts, or bulk import your roster via CSV anytime.
            </p>
            <a
              href={groupResult.managerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block w-full rounded-[12px] py-3 text-[0.9rem] font-bold transition text-center shadow-lg"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Open Delegation Manager Portal →
            </a>
          </div>

          <div className="rounded-[16px] border p-5 space-y-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[0.75rem] font-bold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              Step 2: Share Self-Claim Link with Members
            </p>
            <p className="text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
              Forward this link to your WhatsApp group or email list. Members can claim their individual ticket pass under your organization quota:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={groupResult.claimUrl}
                className="w-full rounded-[8px] border px-3 py-2 text-[0.78rem] font-mono"
                style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-secondary)" }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(groupResult.claimUrl)
                  setGroupCopied(true)
                  setTimeout(() => setGroupCopied(false), 2000)
                }}
                className="shrink-0 rounded-[8px] border px-4 py-2 text-[0.8rem] font-bold transition"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-primary)" }}
              >
                {groupCopied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          <div className="rounded-[12px] border p-4 space-y-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <p className="text-[0.78rem] font-bold" style={{ color: "var(--text-primary)" }}>
              🎫 How Tickets are Issued
            </p>
            <p className="text-[0.78rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Whether you assign attendee names in the portal or your members self-claim via the link, each attendee will immediately receive their own official digital ticket with a unique QR code for seamless check-in at the venue.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-[0.8rem]">
            <button
              type="button"
              onClick={() => {
                setGroupResult(null)
                setRegistrationMode("group")
              }}
              className="text-center underline cursor-pointer"
              style={{ color: "var(--text-muted)" }}
            >
              Make another reservation
            </button>
            <a
              href={`/events/${event.slug}`}
              className="text-center font-semibold"
              style={{ color: "var(--accent)" }}
            >
              Return to Event Overview →
            </a>
          </div>
        </div>
        {showBranding && <BrandingFooter />}
      </div>
    )
  }

  if (bulkResult) {
    const isSingle = bulkResult.results.length === 1
    const communityLink = normalizeCommunityLink(event.communityLink)

    return (
      <div className="mx-auto w-full max-w-[480px]">
        <div className="space-y-4">
          {bulkResult.results.map((r, i) => (
            <div key={i} className="rounded-[16px] p-8" style={resultCardStyle}>
              {r.status === "confirmed" ? (
                <>
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)]">
                    <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
                  </div>
                  <h2 className="text-center text-[1.6rem]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400, color: "var(--text-primary)" }}>
                    {isSingle ? "You're in!" : `Attendee ${i + 1} - You're in!`}
                  </h2>
                  <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                    Your spot for {event.title} is confirmed. We look forward to seeing you.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <span className="rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
                      Confirmed
                    </span>
                  </div>
                  {r.registrationNumber && (
                    <p className="mt-3 text-center text-[0.72rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
                      Registration #{String(r.registrationNumber).padStart(4, "0")}
                    </p>
                  )}
                  {r.confirmationCode && (
                    <div className="mt-4 flex justify-center">
                      <a
                        href={`/register/success/${r.confirmationCode}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(200,245,90,0.4)] bg-[rgba(200,245,90,0.08)] px-4 py-2 text-[0.8rem] text-[#C8F55A]"
                        style={{ fontFamily: "var(--font-dm-sans)", textDecoration: "none", fontWeight: 500 }}
                      >
                        View &amp; Download Ticket
                      </a>
                    </div>
                  )}
                  {communityLink && (
                    <div className="mt-5 rounded-[8px] px-5 py-4" style={{ background: "rgba(200,245,90,0.06)", border: "0.5px solid rgba(200,245,90,0.15)" }}>
                      <p style={{ fontSize: "0.7rem", color: "#C8F55A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                        Join the community
                      </p>
                      <a
                        href={communityLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full rounded-full border border-[rgba(200,245,90,0.4)] px-4 py-2 text-center text-[0.875rem] text-[#C8F55A]"
                        style={{ fontFamily: "var(--font-dm-sans)" }}
                      >
                        {getCommunityLinkLabel(communityLink)}
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,230,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <h2 className="text-center text-[1.6rem]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400, color: "var(--text-primary)" }}>
                    {isSingle ? "You're on the waitlist" : `Attendee ${i + 1} - Waitlist`}
                  </h2>
                  <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                    You are currently position #{r.waitlistPosition} for {event.title}. We will notify you if a slot opens.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <span className="rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
                      Waitlist #{r.waitlistPosition}
                    </span>
                  </div>
                  {r.registrationNumber && (
                    <p className="mt-3 text-center text-[0.72rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
                      Registration #{String(r.registrationNumber).padStart(4, "0")}
                    </p>
                  )}
                  {!hasEmailQuestion && !waitlistEmailSaved[r.registrationId] && (
                    <div style={{ marginTop: "1.25rem", borderRadius: 10, padding: "1rem", ...softPanelStyle }}>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.625rem", lineHeight: 1.5 }}>
                        Enter your email so we can notify you if a slot opens:
                      </p>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={waitlistEmails[r.registrationId] ?? ""}
                          onChange={e => {
                            setWaitlistEmails(prev => ({ ...prev, [r.registrationId]: e.target.value }))
                            if (waitlistEmailErrors[r.registrationId]) {
                              setWaitlistEmailErrors(prev => ({ ...prev, [r.registrationId]: "" }))
                            }
                          }}
                          style={{ flex: 1, minWidth: 0, background: "var(--bg-input)", border: "0.5px solid color-mix(in srgb, var(--text-primary) 15%, transparent)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                        />
                        <button
                          type="button"
                          onClick={() => saveWaitlistEmail(r.registrationId, waitlistEmails[r.registrationId] ?? "")}
                          disabled={waitlistEmailSaving[r.registrationId] || !(waitlistEmails[r.registrationId] ?? "").trim()}
                          style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, color: "#0A0A0A", cursor: waitlistEmailSaving[r.registrationId] ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", opacity: waitlistEmailSaving[r.registrationId] ? 0.7 : 1 }}
                        >
                          {waitlistEmailSaving[r.registrationId] ? "Saving..." : "Notify me"}
                        </button>
                      </div>
                      {waitlistEmailErrors[r.registrationId] && (
                        <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>
                          {waitlistEmailErrors[r.registrationId]}
                        </p>
                      )}
                    </div>
                  )}
                  {!hasEmailQuestion && waitlistEmailSaved[r.registrationId] && (
                    <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.78rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>
                      We will notify you if a slot opens.
                    </p>
                  )}
                </>
              )}
              <div style={{ textAlign: "center", marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
                <a
                  href={`/registration/${r.registrationId}`}
                  style={{ fontSize: "0.78rem", color: "var(--text-muted)", textDecoration: "none" }}
                >
                  View status
                </a>
                <a
                  href={`/registration/${r.registrationId}/edit`}
                  style={{ fontSize: "0.78rem", color: "#C8F55A", textDecoration: "none" }}
                >
                  Edit your details
                </a>
              </div>
            </div>
          ))}
        </div>
        {showBranding && <BrandingFooter />}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[840px]">
      {duplicateInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "color-mix(in srgb, var(--surface) 96%, white 4%)", border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", borderRadius: 18, padding: "1.75rem", width: "min(92vw,460px)", boxShadow: "0 18px 40px rgba(0,0,0,0.24)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,168,0,0.12)", border: "0.5px solid rgba(255,168,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L16.5 15H1.5L9 2z" stroke="#FFA800" strokeWidth="1.25" strokeLinejoin="round" />
                <path d="M9 7v4" stroke="#FFA800" strokeWidth="1.25" strokeLinecap="round" />
                <circle cx="9" cy="13" r="0.75" fill="#FFA800" />
              </svg>
            </div>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#F59E0B", fontFamily: "var(--font-dm-sans)" }}>
              Check before submitting
            </p>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>Similar registration found</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem", lineHeight: 1.6 }}>
              We found a registration in our system with identical details{duplicateInfo.attendeeIndex > 0 ? ` (attendee ${duplicateInfo.attendeeIndex + 1})` : ""}:
            </p>
            <div style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", borderRadius: 12, padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
              {duplicateInfo.registrationNumber !== null && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                  Registration #{String(duplicateInfo.registrationNumber).padStart(4, "0")}
                </p>
              )}
              {duplicateInfo.name && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                  Name: {duplicateInfo.name}
                </p>
              )}
              {duplicateInfo.maskedPhone && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                  Phone: {duplicateInfo.maskedPhone}
                </p>
              )}
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              Is this the same person, or someone different with matching details?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <button
                onClick={() => { setDuplicateInfo(null); setPendingPayload(null) }}
                style={{ background: "transparent", border: "1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", textAlign: "left" }}
              >
                Same person - I&apos;m already registered
              </button>
              <button
                onClick={handleForceRegister}
                disabled={loading}
                style={{ background: "#C8F55A", border: "none", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", textAlign: "left", opacity: loading ? 0.7 : 1 }}
              >
                Different person - continue anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {!compactHeader && event.deadline && (
        <CountdownTimer
          deadline={event.deadline}
          urgentMode
          onExpiredChange={setDeadlineExpired}
        />
      )}
      {compactHeader && event.deadline && (
        <div style={{ display: 'none' }}>
          <CountdownTimer
            deadline={event.deadline}
            urgentMode
            onExpiredChange={setDeadlineExpired}
          />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="w-full overflow-hidden rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.22)] transition-all"
        style={{
          border: "1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 98%, white 2%) 0%, color-mix(in srgb, var(--surface) 100%, transparent) 100%)",
        }}
      >
        {event.imageUrl && (
          <div className="px-4 pt-4 sm:px-6 sm:pt-6" style={{ borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
            <div className="mx-auto max-w-[360px] overflow-hidden rounded-[14px] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.14)]" style={{ border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", background: "color-mix(in srgb, var(--surface) 98%, white 2%)" }}>
              <div className="relative h-[180px] w-full overflow-hidden rounded-[10px]">
                <Image
                  src={event.imageUrl}
                  alt={`${event.title} event visual`}
                  fill
                  sizes="320px"
                  unoptimized
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        )}

        <div className="h-2.5 w-full bg-[linear-gradient(90deg,var(--accent)_0%,color-mix(in_srgb,var(--accent)_45%,transparent)_50%,transparent_100%)]" />

        <div className="space-y-6 p-5 sm:p-8">
          {event.groupRegistrationEnabled && (
            <div className="flex rounded-[12px] border p-1" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <button
                type="button"
                onClick={() => setRegistrationMode("individual")}
                className="flex-1 rounded-[8px] py-2.5 text-[0.8rem] font-bold transition"
                style={{
                  background: registrationMode === "individual" ? "var(--surface)" : "transparent",
                  color: registrationMode === "individual" ? "var(--text-primary)" : "var(--text-secondary)",
                  boxShadow: registrationMode === "individual" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                Register as Individual
              </button>
              <button
                type="button"
                onClick={() => setRegistrationMode("group")}
                className="flex-1 rounded-[8px] py-2.5 text-[0.8rem] font-bold transition"
                style={{
                  background: registrationMode === "group" ? "var(--accent)" : "transparent",
                  color: registrationMode === "group" ? "var(--accent-contrast)" : "var(--text-secondary)",
                  boxShadow: registrationMode === "group" ? "0 2px 8px rgba(0,0,0,0.15)" : "none",
                }}
              >
                Register as Organization / Group
              </button>
            </div>
          )}

          {registrationMode === "group" ? (
            <div className="space-y-5 rounded-[20px] border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <form onSubmit={handleGroupSubmit} className="space-y-4">
                <div>
                  <h3 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>Reserve Organization / Group Slots</h3>
                  <p className="text-[0.8rem]" style={{ color: "var(--text-secondary)" }}>
                    Reserve attendee capacity for your church, company, school, NGO, or delegation now and assign attendee names later.
                  </p>
                </div>

                {groupError && (
                  <p className="rounded-[8px] p-3 text-[0.8rem] font-semibold" style={{ background: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" }}>
                    {groupError}
                  </p>
                )}

                <div>
                  <label className="block text-[0.78rem] font-semibold" style={{ color: groupFieldErrors.orgName ? "#EF4444" : "var(--text-secondary)" }}>
                    Organization / Group Name *
                  </label>
                  <input
                    id="gb-orgName"
                    type="text"
                    required
                    placeholder="e.g. City of Refuge Assembly"
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value)
                      if (groupFieldErrors.orgName) setGroupFieldErrors(prev => ({ ...prev, orgName: "" }))
                    }}
                    className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] transition-colors"
                    style={{
                      borderColor: groupFieldErrors.orgName ? "#EF4444" : "var(--border)",
                      background: "var(--bg-page)",
                      color: "var(--text-primary)",
                      boxShadow: groupFieldErrors.orgName ? "0 0 0 1px #EF4444" : "none",
                    }}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[0.78rem] font-semibold" style={{ color: "var(--text-secondary)" }}>
                      Organization Type *
                    </label>
                    <select
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem]"
                      style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-primary)" }}
                    >
                      <option value="CHURCH">Church / Ministry</option>
                      <option value="COMPANY">Company / Business</option>
                      <option value="SCHOOL">School</option>
                      <option value="UNIVERSITY">University / College</option>
                      <option value="NGO">NGO / Non-Profit</option>
                      <option value="SPONSOR">Sponsor / Partner</option>
                      <option value="FAMILY_TEAM">Family / Team</option>
                      <option value="OTHER">Other Group</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[0.78rem] font-semibold" style={{ color: groupFieldErrors.groupSlots || groupFieldErrors.totalSlots ? "#EF4444" : "var(--text-secondary)" }}>
                      Number of Reserved Slots *
                    </label>
                    <input
                      id="gb-groupSlots"
                      type="number"
                      min="1"
                      max="500"
                      required
                      value={groupSlots}
                      onChange={(e) => {
                        setGroupSlots(Math.max(1, Number(e.target.value)))
                        if (groupFieldErrors.groupSlots || groupFieldErrors.totalSlots) {
                          setGroupFieldErrors(prev => ({ ...prev, groupSlots: "", totalSlots: "" }))
                        }
                      }}
                      className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] transition-colors"
                      style={{
                        borderColor: groupFieldErrors.groupSlots || groupFieldErrors.totalSlots ? "#EF4444" : "var(--border)",
                        background: "var(--bg-page)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[0.78rem] font-semibold" style={{ color: groupFieldErrors.orgContactName || groupFieldErrors.contactName ? "#EF4444" : "var(--text-secondary)" }}>
                    Primary Contact Name *
                  </label>
                  <input
                    id="gb-contactName"
                    type="text"
                    required
                    placeholder="Contact person full name"
                    value={orgContactName}
                    onChange={(e) => {
                      setOrgContactName(e.target.value)
                      if (groupFieldErrors.orgContactName || groupFieldErrors.contactName) {
                        setGroupFieldErrors(prev => ({ ...prev, orgContactName: "", contactName: "" }))
                      }
                    }}
                    className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] transition-colors"
                    style={{
                      borderColor: groupFieldErrors.orgContactName || groupFieldErrors.contactName ? "#EF4444" : "var(--border)",
                      background: "var(--bg-page)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-[0.78rem] font-semibold" style={{ color: groupFieldErrors.orgContactEmail || groupFieldErrors.contactEmail ? "#EF4444" : "var(--text-secondary)" }}>
                      Contact Email Address *
                    </label>
                    <input
                      id="gb-contactEmail"
                      type="email"
                      required
                      placeholder="contact@organization.com"
                      value={orgContactEmail}
                      onChange={(e) => {
                        setOrgContactEmail(e.target.value)
                        if (groupFieldErrors.orgContactEmail || groupFieldErrors.contactEmail) {
                          setGroupFieldErrors(prev => ({ ...prev, orgContactEmail: "", contactEmail: "" }))
                        }
                      }}
                      className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] transition-colors"
                      style={{
                        borderColor: groupFieldErrors.orgContactEmail || groupFieldErrors.contactEmail ? "#EF4444" : "var(--border)",
                        background: "var(--bg-page)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[0.78rem] font-semibold" style={{ color: groupFieldErrors.orgContactPhone || groupFieldErrors.contactPhone ? "#EF4444" : "var(--text-secondary)" }}>
                      Contact Phone Number *
                    </label>
                    <input
                      id="gb-contactPhone"
                      type="tel"
                      required
                      placeholder="0712345678"
                      value={orgContactPhone}
                      onChange={(e) => {
                        setOrgContactPhone(e.target.value)
                        if (groupFieldErrors.orgContactPhone || groupFieldErrors.contactPhone) {
                          setGroupFieldErrors(prev => ({ ...prev, orgContactPhone: "", contactPhone: "" }))
                        }
                      }}
                      className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] transition-colors"
                      style={{
                        borderColor: groupFieldErrors.orgContactPhone || groupFieldErrors.contactPhone ? "#EF4444" : "var(--border)",
                        background: "var(--bg-page)",
                        color: "var(--text-primary)",
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={groupSubmitting || !orgName.trim() || !orgContactName.trim()}
                  className="w-full rounded-[12px] py-3 text-[0.9rem] font-bold transition disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                >
                  {groupSubmitting ? "Reserving Allocation..." : `Reserve ${groupSlots} Group Slots`}
                </button>
              </form>
            </div>
          ) : (
            <fieldset
              disabled={registrationClosed}
              style={{ border: "none", margin: 0, padding: 0, display: "contents" }}
            >
              {/* Subtle Step Progress Indicator */}
              <RegistrationStepIndicator
                steps={steps}
                currentStepIndex={currentStepIndex}
                onStepClick={(targetIdx) => {
                  if (targetIdx < currentStepIndex) {
                    setCurrentStepIndex(targetIdx)
                  }
                }}
              />

              {/* STEP 0: WELCOME SCREEN */}
              {currentStepIndex === 0 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="text-center space-y-3 py-2">
                    <EventSlotWelcomeAvatar />
                    <p style={{ fontSize: "0.74rem", color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
                      {formCopy.registrationForm}
                    </p>
                    <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", color: "var(--text-primary)", lineHeight: 1.15, margin: 0 }}>
                      {displayTitle}
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {effectiveEventDate && (
                      <div className="rounded-[16px] px-4 py-3.5" style={mutedCardStyle}>
                        <p className="mb-1 text-[0.7rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Date</p>
                        <p className="m-0 text-[0.95rem] font-medium" style={{ color: "var(--text-primary)" }}>
                          {formatEventDateRange(effectiveEventDate, effectiveEventEndAt)}
                          {event.isRecurring ? ` (${event.recurrenceFrequency === "BIWEEKLY" ? "Every 2 weeks" : event.recurrenceFrequency === "MONTHLY" ? "Monthly" : "Weekly"})` : ""}
                        </p>
                      </div>
                    )}
                    {event.location && (
                      <div className="rounded-[16px] px-4 py-3.5" style={mutedCardStyle}>
                        <p className="mb-1 text-[0.7rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Location</p>
                        <p className="m-0 text-[0.95rem] font-medium truncate" style={{ color: "var(--text-primary)" }}>{event.location}</p>
                        {event.mapDirectionsUrl && (
                          <a
                            href={event.mapDirectionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-[0.78rem] font-semibold"
                            style={{ color: "var(--accent)", textDecoration: "none" }}
                          >
                            <span>Get directions</span>
                            <span aria-hidden="true">↗</span>
                          </a>
                        )}
                      </div>
                    )}
                    {entryLabel && (
                      <div className="rounded-[16px] px-4 py-3.5" style={mutedCardStyle}>
                        <p className="mb-1 text-[0.7rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Entry amount</p>
                        <p className="m-0 text-[0.95rem] font-medium" style={{ color: "var(--text-primary)" }}>{entryLabel}</p>
                      </div>
                    )}
                    {event.organizerName && (
                      <div className="rounded-[16px] px-4 py-3.5" style={mutedCardStyle}>
                        <p className="mb-1 text-[0.7rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Hosted by</p>
                        <p className="m-0 text-[0.95rem] font-medium truncate" style={{ color: "var(--text-primary)" }}>{event.organizerName}</p>
                      </div>
                    )}
                  </div>

                  {/* Intro card styled with theme tokens */}
                  <div className="rounded-[16px] px-4 py-3" style={mutedCardStyle}>
                    <p className="m-0 text-[0.92rem] leading-7" style={{ color: "var(--text-secondary)" }}>
                      {formCopy.intro}
                    </p>
                  </div>

                  {registrationClosed && (
                    <div className="rounded-[18px] px-4 py-4" style={{ border: "1px solid rgba(255,107,107,0.22)", background: "color-mix(in srgb, rgba(255,107,107,0.08) 55%, var(--surface) 45%)" }}>
                      <p className="m-0 text-[0.72rem] uppercase tracking-[0.08em] text-[#FF6B6B]">Event closed</p>
                      <p className="m-0 mt-2 text-[0.92rem] leading-7" style={{ color: "var(--text-secondary)" }}>
                        Registration is closed, but attendees can still review the event details, open directions, and contact the organiser.
                      </p>
                    </div>
                  )}

                  {event.isPaid && <BillingPausedNotice context="paidEventRegistration" compact />}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={registrationClosed || (event.isPaid ?? false)}
                      className="w-full flex items-center justify-center gap-2 rounded-[14px] py-4 text-[0.96rem] font-bold transition-all transform shadow-[0_8px_24px_rgba(200,245,90,0.25)] hover:translate-y-[-1px] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                    >
                      <span>Start Registration</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              )}

              {/* DRAFT PROGRESS CARD — Always mounted in DOM so draft restores & autosaves reliably */}
              <div className="rounded-[18px] px-4 py-4" style={{ border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)", background: "color-mix(in srgb, var(--accent) 8%, var(--surface) 92%)" }}>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <label className={subtleLabelClassName} style={{ ...subtleLabelStyle, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-secondary)" }}>
                        <rect x="1.5" y="3" width="13" height="10" rx="2" />
                        <path d="M2 4l6 4 6-4" />
                      </svg>
                      {formCopy.saveProgress}
                    </label>
                    <input
                      type="email"
                      placeholder="your@email.com"
                      className={fieldClassName}
                      style={fieldStyle}
                      value={draftEmail}
                      onChange={e => setDraftEmail(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[180px] text-[0.76rem]" style={{ color: "var(--text-secondary)" }}>
                    {draftState === "saving" || draftState === "loading" ? draftMessage : draftMessage || formCopy.restoreProgress}
                  </div>
                </div>
              </div>

              {/* STEP 1: PERSONAL DETAILS */}
              <div className={currentStepIndex === 1 ? "space-y-6 block animate-fadeIn" : "hidden"}>
                <div className="space-y-1">
                  <h3 className="text-[1.25rem] font-bold" style={{ color: "var(--text-primary)" }}>
                    Personal Details
                  </h3>
                  <p className="text-[0.84rem]" style={{ color: "var(--text-secondary)" }}>
                    Please provide the attendee contact information for ticket delivery and event coordination.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-[16px] px-4 py-3" style={mutedCardStyle}>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                    {attendees.length > 1 ? formCopy.registeringMany.replace("{count}", String(attendees.length)) : formCopy.registeringOne}
                  </span>
                  {canAddMore && (
                    <button
                      type="button"
                      onClick={addAttendee}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(200,245,90,0.12)",
                        border: "0.5px solid rgba(200,245,90,0.3)",
                        color: "#C8F55A",
                        fontSize: "1.1rem",
                        lineHeight: 1,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      aria-label="Add attendee"
                    >
                      +
                    </button>
                  )}
                </div>

                {attendees.map((form, attendeeIndex) => (
                  <div key={attendeeIndex} className="rounded-[20px] p-5 space-y-4" style={questionCardStyle}>
                    <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                      <span className="text-[0.72rem] font-bold tracking-wider uppercase" style={{ color: "var(--accent)" }}>
                        {formCopy.attendee} {attendeeIndex + 1}
                      </span>
                      {attendeeIndex > 0 && (
                        <button
                          type="button"
                          onClick={() => removeAttendee(attendeeIndex)}
                          className="text-xs text-[var(--text-muted)] hover:text-red-400 p-1"
                          aria-label="Remove attendee"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    {!hasEmailQuestion && (
                      <div>
                        <label
                          htmlFor={`base-email-${attendeeIndex}`}
                          className={subtleLabelClassName}
                          style={{
                            ...subtleLabelStyle,
                            color: questionErrors[`${attendeeIndex}:baseEmail`] ? "#EF4444" : subtleLabelStyle?.color,
                          }}
                        >
                          {formCopy.emailAddress} <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>({formCopy.forTicket})</span>
                        </label>
                        <input
                          id={`base-email-${attendeeIndex}`}
                          type="email"
                          placeholder="your@email.com"
                          className={fieldClassName}
                          style={{
                            ...fieldStyle,
                            borderColor: questionErrors[`${attendeeIndex}:baseEmail`] ? "#EF4444" : fieldStyle?.borderColor,
                            boxShadow: questionErrors[`${attendeeIndex}:baseEmail`] ? "0 0 0 1px #EF4444" : "none",
                          }}
                          value={baseEmails[attendeeIndex] ?? ""}
                          onChange={e => {
                            const val = e.target.value
                            setBaseEmails(prev => { const next = [...prev]; next[attendeeIndex] = val; return next })
                            if (questionErrors[`${attendeeIndex}:baseEmail`]) {
                              setQuestionErrors(prev => ({ ...prev, [`${attendeeIndex}:baseEmail`]: "" }))
                            }
                          }}
                        />
                        {questionErrors[`${attendeeIndex}:baseEmail`] && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-500">
                            <span>⚠️</span>
                            <span>{questionErrors[`${attendeeIndex}:baseEmail`]}</span>
                          </p>
                        )}
                      </div>
                    )}

                    {personalQuestions.map(q => renderQuestionInput(q, attendeeIndex))}
                  </div>
                ))}

                <div className="flex items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-4 py-3 text-[0.88rem] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                  >
                    ← Overview
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-6 py-3 rounded-[12px] text-[0.9rem] font-bold shadow-[0_6px_20px_rgba(200,245,90,0.2)] transition-transform hover:translate-y-[-1px] active:scale-[0.99]"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    Continue →
                  </button>
                </div>
              </div>

              {/* STEP 2: DYNAMIC EVENT QUESTIONS (if any exist) */}
              {eventQuestions.length > 0 && (
                <div className={currentStepIndex === 2 ? "space-y-6 block animate-fadeIn" : "hidden"}>
                  <div className="space-y-1">
                    <h3 className="text-[1.25rem] font-bold" style={{ color: "var(--text-primary)" }}>
                      Event Questions
                    </h3>
                    <p className="text-[0.84rem]" style={{ color: "var(--text-secondary)" }}>
                      Additional questions from the organizer to prepare for your attendance.
                    </p>
                  </div>

                  {attendees.map((form, attendeeIndex) => (
                    <div key={attendeeIndex} className="rounded-[20px] p-5 space-y-4" style={questionCardStyle}>
                      {attendees.length > 1 && (
                        <div className="pb-2 border-b text-[0.72rem] font-bold uppercase tracking-wider text-[var(--accent)]" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                          {formCopy.attendee} {attendeeIndex + 1}
                        </div>
                      )}
                      {eventQuestions.map(q => {
                        if (q.condition && form[q.condition.questionId] !== q.condition.value) {
                          return null
                        }
                        return renderQuestionInput(q, attendeeIndex)
                      })}
                    </div>
                  ))}

                  <div className="flex items-center justify-between gap-4 pt-4 border-t" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-4 py-3 text-[0.88rem] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-6 py-3 rounded-[12px] text-[0.9rem] font-bold shadow-[0_6px_20px_rgba(200,245,90,0.2)] transition-transform hover:translate-y-[-1px] active:scale-[0.99]"
                      style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                    >
                      Review Registration →
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & CONSENT STEP */}
              <div className={isLastStep ? "space-y-6 block animate-fadeIn" : "hidden"}>
                <div className="space-y-1">
                  <h3 className="text-[1.25rem] font-bold" style={{ color: "var(--text-primary)" }}>
                    Review &amp; Confirm
                  </h3>
                  <p className="text-[0.84rem]" style={{ color: "var(--text-secondary)" }}>
                    Please take a moment to review your registration before confirming.
                  </p>
                </div>

                {attendees.map((form, attendeeIndex) => (
                  <div key={attendeeIndex} className="space-y-4">
                    <div className="rounded-[18px] p-5 space-y-3" style={questionCardStyle}>
                      <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                        <span className="text-[0.76rem] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                          Personal Information {attendees.length > 1 ? `(#${attendeeIndex + 1})` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentStepIndex(1)}
                          className="text-[0.78rem] font-semibold text-[var(--accent)] hover:underline"
                        >
                          Edit details
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 text-[0.86rem]">
                        {!hasEmailQuestion && baseEmails[attendeeIndex] && (
                          <div>
                            <span className="block text-[0.7rem] text-[var(--text-muted)] uppercase">Email Address</span>
                            <span className="font-medium text-[var(--text-primary)]">{baseEmails[attendeeIndex]}</span>
                          </div>
                        )}
                        {personalQuestions.map(q => {
                          const val = form[q.id]
                          if (!val) return null
                          return (
                            <div key={q.id}>
                              <span className="block text-[0.7rem] text-[var(--text-muted)] uppercase">{q.label}</span>
                              <span className="font-medium text-[var(--text-primary)] truncate block">
                                {q.type === "checkbox" ? parseCheckboxValue(val).join(", ") : val}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {eventQuestions.length > 0 && (
                      <div className="rounded-[18px] p-5 space-y-3" style={questionCardStyle}>
                        <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                          <span className="text-[0.76rem] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
                            Event Details {attendees.length > 1 ? `(#${attendeeIndex + 1})` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStepIndex(2)}
                            className="text-[0.78rem] font-semibold text-[var(--accent)] hover:underline"
                          >
                            Edit answers
                          </button>
                        </div>

                        <div className="space-y-2.5 text-[0.86rem]">
                          {eventQuestions.map(q => {
                            const val = form[q.id]
                            if (!val) return null
                            const displayVal = q.type === "file"
                              ? parseFileAnswer(val)?.name || "Uploaded file"
                              : q.type === "checkbox"
                              ? parseCheckboxValue(val).join(", ")
                              : val

                            return (
                              <div key={q.id}>
                                <span className="block text-[0.7rem] text-[var(--text-muted)] uppercase">{q.label}</span>
                                <span className="font-medium text-[var(--text-primary)]">{displayVal}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Consent Card — Always accessible in DOM */}
              {consentRequired && (
                <div className={`rounded-[18px] p-4 sm:p-5 ${isLastStep ? "block" : "hidden"}`} style={questionCardStyle}>
                  <div className="mb-3">
                    <p className="m-0 text-[0.94rem] font-semibold" style={{ color: "var(--text-primary)" }}>{formCopy.consentTitle}</p>
                    <p className="mt-1.5 text-[0.86rem] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {consentBody}
                    </p>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer pt-1">
                    <span className="relative flex-shrink-0 mt-0.5">
                      <input
                        id="consent-data-processing"
                        type="checkbox"
                        checked={consentDataProcessing}
                        onChange={e => setConsentDataProcessing(e.target.checked)}
                        className="sr-only"
                      />
                      <span style={{
                        display: "block",
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: consentDataProcessing ? "1.5px solid #C8F55A" : "1.5px solid color-mix(in srgb, var(--text-primary) 22%, transparent)",
                        background: consentDataProcessing ? "#C8F55A" : "transparent",
                        transition: "background 0.15s, border 0.15s",
                      }}>
                        {consentDataProcessing && (
                          <svg width="12" height="9" viewBox="0 0 10 7" fill="none" style={{ display: "block", margin: "5px auto 0" }}>
                            <path d="M1 3.5L3.8 6 9 1" stroke="#0A0A0A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    </span>
                    <span className="text-[0.86rem] leading-snug" style={{ color: "var(--text-primary)" }}>
                      I consent to my data being collected and used for event registration, communication, and event planning purposes.
                      <span className="ml-1 text-[#C8F55A]">*</span>
                    </span>
                  </label>
                </div>
              )}

              {/* Send Response Copy Checkbox */}
              <label className={`flex items-center gap-3 rounded-[18px] px-4 py-3.5 cursor-pointer ${isLastStep ? "flex" : "hidden"}`} style={questionCardStyle}>
                <input
                  id="send-response-copy"
                  type="checkbox"
                  checked={sendResponseCopy}
                  onChange={e => setSendResponseCopy(e.target.checked)}
                  className="h-4 w-4 rounded text-[#C8F55A] focus:ring-[#C8F55A]"
                  style={{ borderColor: "color-mix(in srgb, var(--text-primary) 20%, transparent)", background: "var(--bg-input)" }}
                />
                <span className="flex items-center gap-2 text-[0.86rem]" style={{ color: "var(--text-primary)" }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-secondary)" }}>
                    <rect x="1.5" y="3" width="13" height="10" rx="2" />
                    <path d="M2 4l6 4 6-4" />
                  </svg>
                  <span>{formCopy.sendCopy}</span>
                </span>
              </label>

              {/* Action Controls & Single Submit Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-5" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className={`px-4 py-3 text-[0.88rem] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition ${currentStepIndex === 0 ? "invisible" : ""}`}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => void clearForm()}
                    className="text-[0.85rem] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition"
                  >
                    {formCopy.clear}
                  </button>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {!isLastStep && (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={registrationClosed || (event.isPaid ?? false)}
                      className="w-full sm:w-auto rounded-[12px] px-8 py-3.5 text-[0.92rem] font-bold shadow-[0_8px_24px_rgba(200,245,90,0.25)] transition-all bg-[#C8F55A] text-[#0A0A0A] hover:translate-y-[-1px] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {currentStepIndex === 0 ? "Start Registration →" : "Continue →"}
                    </button>
                  )}

                  <button
                    type="submit"
                    className={
                      isLastStep
                        ? `w-full sm:w-auto rounded-[12px] px-8 py-3.5 text-[0.92rem] font-bold shadow-[0_8px_24px_rgba(200,245,90,0.25)] transition-all ${
                            isSubmitBlocked
                              ? "bg-[#C8F55A] text-[#0A0A0A] opacity-60 cursor-not-allowed"
                              : "bg-[#C8F55A] text-[#0A0A0A] hover:translate-y-[-1px] active:scale-[0.99]"
                          }`
                        : "sr-only"
                    }
                    disabled={isSubmitBlocked}
                  >
                    {windowClosed && recurringWindow
                      ? recurringWindow.label
                      : registrationClosed
                      ? formCopy.closed
                      : loading
                      ? formCopy.submitting
                      : event.isPaid
                      ? formCopy.paidPaused
                      : attendees.length > 1
                      ? formCopy.submitMany.replace("{count}", String(attendees.length))
                      : formCopy.submit}
                  </button>
                </div>
              </div>

              {/* Security & Host Notice */}
              <div className="flex flex-col gap-2 text-center pt-2">
                <p className="m-0 text-[0.76rem]" style={{ color: "var(--text-muted)" }}>
                  {formCopy.passwordNotice}
                </p>
                <p className="m-0 text-[0.76rem] leading-6" style={{ color: "var(--text-muted)" }}>
                  By submitting, you acknowledge the organiser&apos;s event notice and EventSlot&apos;s <a href="/privacy" target="_blank" rel="noreferrer" className="text-[#C8F55A] underline-offset-2 hover:underline">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noreferrer" className="text-[#C8F55A] underline-offset-2 hover:underline">Terms of Service</a>.
                </p>
                <p className="m-0 text-[0.76rem] leading-6" style={{ color: "var(--text-muted)" }}>
                  {formCopy.hostNotice}
                </p>
              </div>
            </fieldset>
          )}
        </div>
      </form>

      {showBranding && <BrandingFooter />}
    </div>
  )
}
