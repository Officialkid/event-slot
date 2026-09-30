import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import { generateVerifierCode } from '../lib/verifierCode'
import { generateConfirmationCode } from '../lib/confirmationCode'

const prisma = new PrismaClient()

// 80 Confirmed Attendees + 22 Waitlist Attendees = 102 total
const ATTENDEE_DATA: Array<{ name: string; email: string; location: string }> = [
  // ── 80 Confirmed Attendees ──────────────────────────────────────────────
  { name: 'Amina Mohamed', email: 'amina.mohamed@example.com', location: 'Nairobi - Kilimani' },
  { name: 'David Kiprono', email: 'david.kiprono@example.com', location: 'Nairobi - Westlands' },
  { name: 'Sharon Chebet', email: 'sharon.chebet@example.com', location: 'Nairobi - Karen' },
  { name: 'Brian Ochieng', email: 'brian.ochieng@example.com', location: 'Nairobi - Upper Hill' },
  { name: 'Kevin Mwangi', email: 'kevin.mwangi@example.com', location: 'Nairobi - Lavington' },
  { name: 'Grace Njeri', email: 'grace.njeri@example.com', location: 'Nairobi - Parklands' },
  { name: 'Collins Wambua', email: 'collins.wambua@example.com', location: 'Nairobi - South C' },
  { name: 'Cynthia Achieng', email: 'cynthia.achieng@example.com', location: 'Nairobi - CBD' },
  { name: 'Samuel Mutua', email: 'samuel.mutua@example.com', location: 'Nairobi - Kileleshwa' },
  { name: 'Victor Otieno', email: 'victor.otieno@example.com', location: 'Nairobi - Ngong Road' },
  { name: 'Brenda Wanjiru', email: 'brenda.wanjiru@example.com', location: 'Nairobi - Runda' },
  { name: 'Faith Muthoni', email: 'faith.muthoni@example.com', location: 'Nairobi - Kilimani' },
  { name: 'Ian Kamau', email: 'ian.kamau@example.com', location: 'Nairobi - Westlands' },
  { name: 'Mercy Ndinda', email: 'mercy.ndinda@example.com', location: 'Mombasa - Nyali' },
  { name: 'Dennis Omondi', email: 'dennis.omondi@example.com', location: 'Kisumu - Milimani' },
  { name: 'Lucy Karimi', email: 'lucy.karimi@example.com', location: 'Nakuru - Milimani' },
  { name: 'Evans Kiprop', email: 'evans.kiprop@example.com', location: 'Eldoret - Elgon View' },
  { name: 'Joan Wairimu', email: 'joan.wairimu@example.com', location: 'Thika - Greens' },
  { name: 'Alex Mutiso', email: 'alex.mutiso@example.com', location: 'Machakos - Town' },
  { name: 'Esther Adhiambo', email: 'esther.adhiambo@example.com', location: 'Nairobi - Langata' },
  { name: 'Kelvin Macharia', email: 'kelvin.macharia@example.com', location: 'Nairobi - Kasarani' },
  { name: 'Maureen Wangari', email: 'maureen.wangari@example.com', location: 'Nairobi - Roysambu' },
  { name: 'Peter Cheruiyot', email: 'peter.cheruiyot@example.com', location: 'Kericho - Town' },
  { name: 'Naomi Wangui', email: 'naomi.wangui@example.com', location: 'Nyeri - Town' },
  { name: 'Michael Odhiambo', email: 'michael.odhiambo@example.com', location: 'Nairobi - South B' },
  { name: 'Ruth Moraa', email: 'ruth.moraa@example.com', location: 'Kisii - Town' },
  { name: 'Geoffrey Kibet', email: 'geoffrey.kibet@example.com', location: 'Nairobi - Karen' },
  { name: 'Christine Atieno', email: 'christine.atieno@example.com', location: 'Nairobi - Kileleshwa' },
  { name: 'Patrick Maina', email: 'patrick.maina@example.com', location: 'Kiambu - Town' },
  { name: 'Ivy Chepkemoi', email: 'ivy.chepkemoi@example.com', location: 'Nairobi - Westlands' },
  { name: 'Felix Onyango', email: 'felix.onyango@example.com', location: 'Homa Bay' },
  { name: 'Diana Nyambura', email: 'diana.nyambura@example.com', location: 'Nairobi - Lavington' },
  { name: 'Joseph Kimani', email: 'joseph.kimani@example.com', location: 'Nairobi - Upper Hill' },
  { name: 'Beatrice Akinyi', email: 'beatrice.akinyi@example.com', location: 'Nairobi - Kilimani' },
  { name: 'Emmanuel Kiprotich', email: 'emmanuel.kiprotich@example.com', location: 'Eldoret' },
  { name: 'Miriam Wambui', email: 'miriam.wambui@example.com', location: 'Naivasha' },
  { name: 'Stephen Musyoka', email: 'stephen.musyoka@example.com', location: 'Kitui' },
  { name: 'Lilian Jepchirchir', email: 'lilian.jepchirchir@example.com', location: 'Nandi Hills' },
  { name: 'George Ochieng', email: 'george.ochieng@example.com', location: 'Nairobi - Buruburu' },
  { name: 'Phyllis Muthoni', email: 'phyllis.muthoni@example.com', location: 'Nairobi - Parklands' },
  { name: 'Allan Kipkoech', email: 'allan.kipkoech@example.com', location: 'Bomet' },
  { name: 'Gladys Njoki', email: 'gladys.njoki@example.com', location: 'Nairobi - Ruaka' },
  { name: 'Humphrey Barasa', email: 'humphrey.barasa@example.com', location: 'Kakamega' },
  { name: 'Jackline Chepngetich', email: 'jackline.chepngetich@example.com', location: 'Nairobi - South C' },
  { name: 'Antony Ndung\'u', email: 'antony.ndungu@example.com', location: 'Nairobi - CBD' },
  { name: 'Doreen Kwamboka', email: 'doreen.kwamboka@example.com', location: 'Nairobi - Kilimani' },
  { name: 'Kennedy Mutua', email: 'kennedy.mutua@example.com', location: 'Machakos' },
  { name: 'Joy Wanjiku', email: 'joy.wanjiku@example.com', location: 'Nairobi - Westlands' },
  { name: 'Oscar Otieno', email: 'oscar.otieno@example.com', location: 'Kisumu' },
  { name: 'Caroline Wangari', email: 'caroline.wangari@example.com', location: 'Nairobi - Karen' },
  { name: 'Silas Kipruto', email: 'silas.kipruto@example.com', location: 'Eldoret' },
  { name: 'Purity Mwikali', email: 'purity.mwikali@example.com', location: 'Nairobi - Embakasi' },
  { name: 'Edwin Mogaka', email: 'edwin.mogaka@example.com', location: 'Nairobi - Kileleshwa' },
  { name: 'Hellen Anyango', email: 'hellen.anyango@example.com', location: 'Siaya' },
  { name: 'Moses Kariuki', email: 'moses.kariuki@example.com', location: 'Nairobi - Thome' },
  { name: 'Rosemary Chelangat', email: 'rosemary.chelangat@example.com', location: 'Nairobi - Lavington' },
  { name: 'Bernard Omondi', email: 'bernard.omondi@example.com', location: 'Nairobi - Parklands' },
  { name: 'Winnie Muthoni', email: 'winnie.muthoni@example.com', location: 'Nairobi - Westlands' },
  { name: 'Charles Kipkemboi', email: 'charles.kipkemboi@example.com', location: 'Iten' },
  { name: 'Irene Gathoni', email: 'irene.gathoni@example.com', location: 'Nairobi - Kilimani' },
  { name: 'Titus Mutiso', email: 'titus.mutiso@example.com', location: 'Makueni' },
  { name: 'Eunice Adhiambo', email: 'eunice.adhiambo@example.com', location: 'Kisumu' },
  { name: 'Francis Njoroge', email: 'francis.njoroge@example.com', location: 'Nairobi - Karen' },
  { name: 'Alice Jebet', email: 'alice.jebet@example.com', location: 'Kabarnet' },
  { name: 'Martin Okoth', email: 'martin.okoth@example.com', location: 'Nairobi - South B' },
  { name: 'Janet Nyawira', email: 'janet.nyawira@example.com', location: 'Nyeri' },
  { name: 'Daniel Korir', email: 'daniel.korir@example.com', location: 'Nakuru' },
  { name: 'Sarah Mumbua', email: 'sarah.mumbua@example.com', location: 'Nairobi - CBD' },
  { name: 'Geoffrey Ouma', email: 'geoffrey.ouma@example.com', location: 'Migori' },
  { name: 'Pauline Wanjiru', email: 'pauline.wanjiru@example.com', location: 'Nairobi - Westlands' },
  { name: 'Vincent Kiptoo', email: 'vincent.kiptoo@example.com', location: 'Eldoret' },
  { name: 'Regina Moraa', email: 'regina.moraa@example.com', location: 'Nairobi - Kilimani' },
  { name: 'Albert Mwangi', email: 'albert.mwangi@example.com', location: 'Murang\'a' },
  { name: 'Faith Chepkoech', email: 'faith.chepkoech@example.com', location: 'Nairobi - Upper Hill' },
  { name: 'Philip Otieno', email: 'philip.otieno@example.com', location: 'Nairobi - Lavington' },
  { name: 'Mercyline Kerubo', email: 'mercyline.kerubo@example.com', location: 'Kisii' },
  { name: 'Erick Kiplagat', email: 'erick.kiplagat@example.com', location: 'Baringo' },
  { name: 'Catherine Nduta', email: 'catherine.nduta@example.com', location: 'Nairobi - Runda' },
  { name: 'Joshua Mutuku', email: 'joshua.mutuku@example.com', location: 'Nairobi - South C' },
  { name: 'Valerie Akoth', email: 'valerie.akoth@example.com', location: 'Nairobi - Kileleshwa' },

  // ── 22 Waitlist Attendees (Waitlist Position #1 to #22) ──────────────────
  { name: 'Clifford Oduor', email: 'clifford.oduor@example.com', location: 'Nairobi - Westlands' },
  { name: 'Nancy Jeptepkeny', email: 'nancy.jeptepkeny@example.com', location: 'Eldoret' },
  { name: 'Gideon Wekesa', email: 'gideon.wekesa@example.com', location: 'Bungoma' },
  { name: 'Leah Nyambura', email: 'leah.nyambura@example.com', location: 'Nairobi - Kilimani' },
  { name: 'Harrison Kinyua', email: 'harrison.kinyua@example.com', location: 'Embu' },
  { name: 'Zipporah Chebet', email: 'zipporah.chebet@example.com', location: 'Nairobi - Karen' },
  { name: 'Lucas Omondi', email: 'lucas.omondi@example.com', location: 'Kisumu' },
  { name: 'Tabitha Muthoni', email: 'tabitha.muthoni@example.com', location: 'Nairobi - Lavington' },
  { name: 'Cornelius Kipchumba', email: 'cornelius.kipchumba@example.com', location: 'Nakuru' },
  { name: 'Priscilla Achieng', email: 'priscilla.achieng@example.com', location: 'Nairobi - Upper Hill' },
  { name: 'Timothy Ndegwa', email: 'timothy.ndegwa@example.com', location: 'Nyeri' },
  { name: 'Brenda Chepkirui', email: 'brenda.chepkirui@example.com', location: 'Kericho' },
  { name: 'Douglas Masika', email: 'douglas.masika@example.com', location: 'Nairobi - South C' },
  { name: 'Elizabeth Wairimu', email: 'elizabeth.wairimu@example.com', location: 'Kiambu' },
  { name: 'Boniface Mutua', email: 'boniface.mutua@example.com', location: 'Machakos' },
  { name: 'Millicent Anyango', email: 'millicent.anyango@example.com', location: 'Nairobi - CBD' },
  { name: 'Samson Kiprotich', email: 'samson.kiprotich@example.com', location: 'Eldoret' },
  { name: 'Angela Wanjiru', email: 'angela.wanjiru@example.com', location: 'Nairobi - Parklands' },
  { name: 'Walter Ouma', email: 'walter.ouma@example.com', location: 'Homa Bay' },
  { name: 'Vivian Chepkemoi', email: 'vivian.chepkemoi@example.com', location: 'Nairobi - Westlands' },
  { name: 'Rodgers Mwenda', email: 'rodgers.mwenda@example.com', location: 'Meru' },
  { name: 'Gladwell Wangui', email: 'gladwell.wangui@example.com', location: 'Nairobi - Kileleshwa' },
]

async function main() {
  console.log('Seeding EventSlot Annual Dinner with 102 attendees...')

  // Clean up any old dummy event with the same title/slug
  const existingEvent = await prisma.event.findFirst({
    where: {
      OR: [
        { slug: 'eventslot-annual-dinner' },
        { title: 'EventSlot Annual Dinner' },
      ],
    },
    include: { registrations: true },
  })

  if (existingEvent) {
    console.log(`Found existing event (${existingEvent.id}), removing old dummy records...`)
    await prisma.registration.deleteMany({ where: { eventId: existingEvent.id } })
    await prisma.event.delete({ where: { id: existingEvent.id } })
    console.log('Deleted old event and associated registrations.')
  }

  // Find host organizer
  const organizer = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'eventslot.co@gmail.com' },
        { email: 'danielmwaliliofficial@gmail.com' },
        { email: 'danielmwalili1@gmail.com' },
      ],
    },
  })

  const organizerId = organizer?.id ?? 'cmoh7xtld0000or2srb31uwfr'
  const organizerEmail = organizer?.email ?? 'eventslot.co@gmail.com'
  const organizerName = organizer?.name ?? 'EventSlot'

  console.log(`Organizer: ${organizerName} (${organizerEmail}, id: ${organizerId})`)

  // Define Event Questions
  const questions = [
    {
      id: 'name',
      type: 'text',
      label: 'Full Name',
      required: true,
    },
    {
      id: 'email',
      type: 'email',
      label: 'Email Address',
      required: true,
    },
    {
      id: 'location',
      type: 'text',
      label: 'Location',
      required: true,
    },
  ]

  // Event Date: Saturday Nov 28, 2026, 6:00 PM to 10:00 PM (EAT)
  const eventDate = new Date('2026-11-28T15:00:00.000Z') // 18:00 UTC+3
  const eventEndAt = new Date('2026-11-28T19:00:00.000Z') // 22:00 UTC+3
  const deadline = new Date('2026-11-27T20:59:59.000Z') // 23:59 UTC+3 day before

  const event = await prisma.event.create({
    data: {
      title: 'EventSlot Annual Dinner',
      slug: 'eventslot-annual-dinner',
      description:
        'Join us for the premier EventSlot Annual Dinner — an exclusive evening of connection, celebration, and inspiring conversations with organizers, creators, and community leaders.',
      visibility: 'PUBLIC',
      accessType: 'REGISTRATION',
      eventType: 'PHYSICAL',
      capacity: 80,
      confirmedCount: 80,
      waitlistCount: 22,
      deadline,
      eventDate,
      eventEndAt,
      hasSpecificTime: true,
      location: 'Villa Rosa Kempinski, Nairobi',
      mapDirectionsUrl: 'https://www.google.com/maps/search/?api=1&query=Villa+Rosa+Kempinski+Nairobi',
      entryFeeLabel: 'Complimentary / Invitation Only',
      showRemainingSpots: true,
      attendeeConsentEnabled: true,
      attendeeConsentText: 'I agree to the collection and use of my registration details for event coordination and entry check-in.',
      ticketsEnabled: true,
      isPaid: false,
      status: 'active',
      imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
      dashboardToken: uuidv4(),
      verifierCode: generateVerifierCode(),
      questions,
      organizerEmail,
      organizerName,
      organizerId,
      isTestData: true,
    },
  })

  console.log(`Created Event: "${event.title}" (slug: ${event.slug}, id: ${event.id})`)

  // Base timestamps over the last 6 days
  const now = new Date()
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)

  // 1. Create 80 Confirmed Attendees
  console.log('Inserting 80 Confirmed Attendees...')
  for (let i = 0; i < 80; i++) {
    const data = ATTENDEE_DATA[i]
    const regNumber = i + 1

    // Spread registration timestamps over the past 5 days
    const timeOffsetMs = Math.floor((i / 80) * 5 * 24 * 60 * 60 * 1000)
    const submittedAt = new Date(sixDaysAgo.getTime() + timeOffsetMs)

    // Ensure User record exists
    await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        name: data.name,
        isTestData: true,
      },
    })

    await prisma.registration.create({
      data: {
        eventId: event.id,
        status: 'confirmed',
        registrationNumber: regNumber,
        waitlistPosition: null,
        confirmationCode: generateConfirmationCode(),
        qrCode: uuidv4(),
        submittedAt,
        attendeeEmail: data.email,
        consentDataProcessing: true,
        source: 'form',
        countryCode: 'KE',
        isTestData: true,
        answers: [
          { questionId: 'name', value: data.name },
          { questionId: 'email', value: data.email },
          { questionId: 'location', value: data.location },
        ],
      },
    })
  }

  // 2. Create 22 Waitlist Attendees
  console.log('Inserting 22 Waitlist Attendees...')
  for (let i = 0; i < 22; i++) {
    const data = ATTENDEE_DATA[80 + i]
    const waitlistPosition = i + 1

    // Waitlist registrations submitted over the last 24 hours
    const timeOffsetMs = Math.floor((i / 22) * 24 * 60 * 60 * 1000)
    const submittedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000 + timeOffsetMs)

    // Ensure User record exists
    await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        name: data.name,
        isTestData: true,
      },
    })

    await prisma.registration.create({
      data: {
        eventId: event.id,
        status: 'waitlist',
        registrationNumber: 0,
        waitlistPosition,
        confirmationCode: generateConfirmationCode(),
        qrCode: uuidv4(),
        submittedAt,
        attendeeEmail: data.email,
        consentDataProcessing: true,
        source: 'form',
        countryCode: 'KE',
        isTestData: true,
        answers: [
          { questionId: 'name', value: data.name },
          { questionId: 'email', value: data.email },
          { questionId: 'location', value: data.location },
        ],
      },
    })
  }

  console.log('========================================================')
  console.log('✅ Successfully seeded EventSlot Annual Dinner!')
  console.log(`- Event ID:            ${event.id}`)
  console.log(`- Slug:                ${event.slug}`)
  console.log(`- Capacity:            80`)
  console.log(`- Confirmed Count:     80 (Filled!)`)
  console.log(`- Waitlist Count:      22 (Waitlist #1 to #22)`)
  console.log(`- Total Attendees:     102`)
  console.log(`- Next Registration:   Will be 103rd attendee (Waitlist #23)!`)
  console.log(`- Public URL:          /${event.slug}`)
  console.log('========================================================')
}

main()
  .catch(err => {
    console.error('Seeding failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
