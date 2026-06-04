import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuestionAnswer {
  questionId: string
  label:      string
  answer:     string | null
}

interface RegistrationEntry {
  id?:             string
  index:           number
  name:            string
  email:           string
  phone:           string | null
  status:          'confirmed' | 'waitlist'
  registeredAt:    string
  ticketCode:      string | null
  questionAnswers: QuestionAnswer[]
}

interface RegistrationsPdfProps {
  eventTitle:       string
  eventDate:        string
  eventLocation:    string
  totalConfirmed:   number
  totalWaitlisted:  number
  exportedAt:       string
  registrations:    RegistrationEntry[]
  statusFilter:     string
}

// ── Accent colour (used once — status badge fill) ─────────────────────────────
const CONFIRMED_COLOR = '#1A73E8'   // Google blue — clear on white BW print
const WAITLIST_COLOR  = '#F29900'   // Google amber

// ── Styles ────────────────────────────────────────────────────────────────────
// Google Forms-inspired: white pages, questions stacked vertically, full answers
const styles = StyleSheet.create({
  // ── Shared page layout ────────────────────────────────────────────────────
  page: {
    backgroundColor:   '#FFFFFF',
    paddingTop:        48,
    paddingBottom:     60,
    paddingHorizontal: 54,
    fontFamily:        'Helvetica',
  },

  // ── Cover page ───────────────────────────────────────────────────────────
  coverTitle: {
    fontSize:     28,
    fontFamily:   'Helvetica-Bold',
    color:        '#202124',
    marginBottom: 8,
    lineHeight:   1.3,
  },
  coverMeta: {
    fontSize:     11,
    color:        '#5F6368',
    marginBottom: 4,
    lineHeight:   1.5,
  },
  coverDivider: {
    borderBottomWidth: 3,
    borderBottomColor: '#4285F4',
    marginTop:         20,
    marginBottom:      28,
  },
  coverSummaryRow: {
    flexDirection:    'row',
    gap:              16,
    marginBottom:     32,
  },
  coverSummaryCard: {
    flex:              1,
    borderWidth:       1,
    borderColor:       '#DADCE0',
    borderRadius:      4,
    padding:           14,
  },
  coverSummaryLabel: {
    fontSize:      9,
    color:         '#5F6368',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom:  4,
  },
  coverSummaryValue: {
    fontSize:   20,
    fontFamily: 'Helvetica-Bold',
    color:      '#202124',
  },

  // ── Per-attendee page top block ───────────────────────────────────────────
  responseHeader: {
    marginBottom: 20,
  },
  responseFormTitle: {
    fontSize:     13,
    fontFamily:   'Helvetica-Bold',
    color:        '#202124',
    marginBottom: 3,
  },
  responseFormSubtitle: {
    fontSize:  9,
    color:     '#5F6368',
    lineHeight: 1.5,
  },
  responseHeaderDivider: {
    borderBottomWidth: 3,
    borderBottomColor: '#4285F4',
    marginTop:         12,
    marginBottom:      16,
  },

  // Respondent identity strip (name, email, status, meta)
  identityBlock: {
    borderWidth:   1,
    borderColor:   '#DADCE0',
    borderRadius:  4,
    padding:       14,
    marginBottom:  20,
  },
  identityTopRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'flex-start',
    marginBottom:    8,
  },
  identityName: {
    fontSize:   16,
    fontFamily: 'Helvetica-Bold',
    color:      '#202124',
    flex:        1,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      100,
    marginLeft:        12,
  },
  statusPillText: {
    fontSize:   8,
    fontFamily: 'Helvetica-Bold',
    color:      '#FFFFFF',
    letterSpacing: 0.5,
  },
  identityMetaRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           4,
  },
  identityMetaItem: {
    fontSize:  9,
    color:     '#5F6368',
  },
  identityMetaSep: {
    fontSize: 9,
    color:    '#DADCE0',
  },

  // ── Question cards ────────────────────────────────────────────────────────
  questionCard: {
    borderWidth:   1,
    borderColor:   '#DADCE0',
    borderRadius:  4,
    padding:       14,
    marginBottom:  10,
  },
  questionLabel: {
    fontSize:      10,
    fontFamily:    'Helvetica-Bold',
    color:         '#202124',
    marginBottom:  8,
    lineHeight:    1.4,
  },
  questionAnswer: {
    fontSize:  11,
    color:     '#202124',
    lineHeight: 1.6,
  },
  questionAnswerEmpty: {
    fontSize:   11,
    color:      '#9AA0A6',
    fontFamily: 'Helvetica-Oblique',
    lineHeight: 1.6,
  },

  // No questions state
  noQuestionsCard: {
    borderWidth:   1,
    borderColor:   '#DADCE0',
    borderRadius:  4,
    padding:       16,
    marginBottom:  10,
  },
  noQuestionsText: {
    fontSize:   10,
    color:      '#9AA0A6',
    fontFamily: 'Helvetica-Oblique',
  },

  // ── Fixed footer (every page) ─────────────────────────────────────────────
  footer: {
    position:       'absolute',
    bottom:         20,
    left:           54,
    right:          54,
    flexDirection:  'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#DADCE0',
    paddingTop:     8,
  },
  footerLeft: {
    fontSize: 7.5,
    color:    '#9AA0A6',
    flex:     1,
  },
  footerRight: {
    fontSize: 7.5,
    color:    '#9AA0A6',
  },
})

// ── Component ─────────────────────────────────────────────────────────────────
export const RegistrationsPdf: React.FC<RegistrationsPdfProps> = ({
  eventTitle,
  eventDate,
  eventLocation,
  totalConfirmed,
  totalWaitlisted,
  exportedAt,
  registrations,
  statusFilter,
}) => {
  const filterLabel =
    statusFilter === 'confirmed' ? 'Confirmed only' :
    statusFilter === 'waitlist'  ? 'Waitlisted only' :
    'All responses'

  const total = registrations.length

  return (
    <Document
      title={`${eventTitle} — Registrations`}
      author="EventSlot"
      subject="Attendee registration responses"
    >

      {/* ── Cover Page ───────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.coverTitle}>{eventTitle}</Text>
        <Text style={styles.coverMeta}>{eventDate}</Text>
        {eventLocation ? <Text style={styles.coverMeta}>{eventLocation}</Text> : null}
        <Text style={styles.coverMeta}>Exported: {exportedAt}  ·  Filter: {filterLabel}</Text>

        <View style={styles.coverDivider} />

        <View style={styles.coverSummaryRow}>
          <View style={styles.coverSummaryCard}>
            <Text style={styles.coverSummaryLabel}>Total responses</Text>
            <Text style={styles.coverSummaryValue}>{total}</Text>
          </View>
          <View style={styles.coverSummaryCard}>
            <Text style={styles.coverSummaryLabel}>Confirmed</Text>
            <Text style={styles.coverSummaryValue}>{totalConfirmed}</Text>
          </View>
          <View style={styles.coverSummaryCard}>
            <Text style={styles.coverSummaryLabel}>Waitlisted</Text>
            <Text style={styles.coverSummaryValue}>{totalWaitlisted}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            EventSlot  ·  eventslot.com  ·  Confidential — personal data protected under Kenya DPA 2019
          </Text>
          <Text
            style={styles.footerRight}
            render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
          />
        </View>
      </Page>

      {/* ── One page per registrant ───────────────────────────────────────── */}
      {registrations.map((reg) => (
        <Page key={reg.id ?? reg.index} size="A4" style={styles.page} wrap>

          {/* Form-style header at top of each attendee page */}
          <View style={styles.responseHeader}>
            <Text style={styles.responseFormTitle}>{eventTitle}</Text>
            <Text style={styles.responseFormSubtitle}>
              {eventDate}{eventLocation ? `  ·  ${eventLocation}` : ''}
            </Text>
            <View style={styles.responseHeaderDivider} />
          </View>

          {/* Respondent identity block */}
          <View style={styles.identityBlock}>
            <View style={styles.identityTopRow}>
              <Text style={styles.identityName}>{reg.name}</Text>
              <View style={[
                styles.statusPill,
                { backgroundColor: reg.status === 'confirmed' ? CONFIRMED_COLOR : WAITLIST_COLOR },
              ]}>
                <Text style={styles.statusPillText}>
                  {reg.status === 'confirmed' ? 'CONFIRMED' : 'WAITLISTED'}
                </Text>
              </View>
            </View>
            <View style={styles.identityMetaRow}>
              <Text style={styles.identityMetaItem}>Response #{reg.index} of {total}</Text>
              <Text style={styles.identityMetaSep}>  ·  </Text>
              <Text style={styles.identityMetaItem}>{reg.email}</Text>
              {reg.phone ? (
                <>
                  <Text style={styles.identityMetaSep}>  ·  </Text>
                  <Text style={styles.identityMetaItem}>{reg.phone}</Text>
                </>
              ) : null}
              <Text style={styles.identityMetaSep}>  ·  </Text>
              <Text style={styles.identityMetaItem}>Submitted {reg.registeredAt}</Text>
              {reg.ticketCode ? (
                <>
                  <Text style={styles.identityMetaSep}>  ·  </Text>
                  <Text style={styles.identityMetaItem}>Ticket: {reg.ticketCode}</Text>
                </>
              ) : null}
            </View>
          </View>

          {/* Questions — vertical list, full answers */}
          {reg.questionAnswers.length > 0 ? (
            reg.questionAnswers.map((qa) => (
              <View key={qa.questionId} style={styles.questionCard}>
                <Text style={styles.questionLabel}>{qa.label}</Text>
                {qa.answer ? (
                  <Text style={styles.questionAnswer}>{qa.answer}</Text>
                ) : (
                  <Text style={styles.questionAnswerEmpty}>No answer provided</Text>
                )}
              </View>
            ))
          ) : (
            <View style={styles.noQuestionsCard}>
              <Text style={styles.noQuestionsText}>No custom question responses.</Text>
            </View>
          )}

          {/* Fixed footer — repeats on every page including overflow pages */}
          <View style={styles.footer} fixed>
            <Text style={styles.footerLeft}>
              EventSlot  ·  eventslot.com  ·  Confidential — personal data protected under Kenya DPA 2019
            </Text>
            <Text
              style={styles.footerRight}
              render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
            />
          </View>

        </Page>
      ))}

    </Document>
  )
}
