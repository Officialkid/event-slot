import { renderToBuffer, Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import QRCode from 'qrcode'

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0A0A0A',
    padding: 0,
    width: 400,
    height: 200,
  },
  container: {
    flexDirection: 'row',
    height: '100%',
  },
  left: {
    flex: 1,
    backgroundColor: '#141414',
    padding: 24,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  brandEvent: {
    fontSize: 11,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  brandSlot: {
    fontSize: 11,
    fontWeight: 700,
    color: '#C8F55A',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  attendeeName: {
    fontSize: 12,
    color: '#A3A3A3',
    marginBottom: 4,
  },
  ticketId: {
    fontSize: 9,
    color: '#525252',
    fontFamily: 'Courier',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: '#525252',
    width: 58,
  },
  metaValue: {
    fontSize: 8,
    color: '#A3A3A3',
    flex: 1,
  },
  tagline: {
    fontSize: 7,
    color: '#2A2A2A',
    marginTop: 8,
  },
  right: {
    width: 120,
    backgroundColor: '#FFFFFF',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCode: {
    width: 80,
    height: 80,
    marginBottom: 8,
  },
  qrLabel: {
    fontSize: 7,
    color: '#333333',
    textAlign: 'center',
  },
  strip: {
    width: 4,
    backgroundColor: '#C8F55A',
  },
})

export interface TicketPDFData {
  eventTitle: string
  attendeeName: string
  ticketId: string
  eventDate: Date | null
  location: string | null
  organizerName: string
}

export async function generateTicketPDF(data: TicketPDFData): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(data.ticketId, {
    width: 200,
    margin: 1,
    color: { dark: '#000000', light: '#FFFFFF' },
  })

  const dateStr = data.eventDate
    ? data.eventDate.toLocaleDateString('en-KE', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'TBA'

  const timeStr = data.eventDate
    ? data.eventDate.toLocaleTimeString('en-KE', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Nairobi',
      })
    : 'TBA'

  const doc = (
    <Document>
      <Page size={[400, 200]} style={styles.page}>
        <View style={styles.container}>
          <View style={styles.strip} />

          <View style={styles.left}>
            <View>
              <View style={styles.brandRow}>
                <Text style={styles.brandEvent}>Event</Text>
                <Text style={styles.brandSlot}>Slot</Text>
              </View>

              <Text style={styles.eventTitle}>{data.eventTitle}</Text>
              <Text style={styles.attendeeName}>{data.attendeeName}</Text>
              <Text style={styles.ticketId}>#{data.ticketId}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>DATE</Text>
                <Text style={styles.metaValue}>{dateStr}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>TIME</Text>
                <Text style={styles.metaValue}>{timeStr} EAT</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>VENUE</Text>
                <Text style={styles.metaValue}>{data.location ?? 'TBA'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>HOST</Text>
                <Text style={styles.metaValue}>{data.organizerName}</Text>
              </View>
            </View>

            <Text style={styles.tagline}>Smarter Events. Better Experiences. - eventsslot.com</Text>
          </View>

          <View style={styles.right}>
            {/* jsx-a11y/alt-text applies to DOM img elements; this is react-pdf's Image component. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrDataUrl} style={styles.qrCode} />
            <Text style={styles.qrLabel}>Scan to verify entry</Text>
          </View>
        </View>
      </Page>
    </Document>
  )

  return renderToBuffer(doc)
}
