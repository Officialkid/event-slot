/**
 * Core type definitions for the EventSlot Careers & Recruitment System.
 */

export const OPPORTUNITY_TYPES = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "TEMPORARY", label: "Temporary / project-based" },
  { value: "VOLUNTEER", label: "Volunteer" },
  { value: "CONSULTANT", label: "Consultant / advisor" },
] as const

export type VacancyTypeValue = typeof OPPORTUNITY_TYPES[number]["value"]

export const WORK_ARRANGEMENTS = [
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "ON_SITE", label: "On-site" },
] as const

export type WorkArrangementValue = typeof WORK_ARRANGEMENTS[number]["value"]

export const VACANCY_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
] as const

export type VacancyStatusValue = typeof VACANCY_STATUSES[number]["value"]

export const APPLICATION_STATUSES = [
  {
    value: "SUBMITTED",
    label: "Submitted",
    description: "Your application has been received and is waiting for initial review.",
  },
  {
    value: "UNDER_REVIEW",
    label: "Under review",
    description: "Your application is currently being evaluated by the hiring team.",
  },
  {
    value: "SHORTLISTED",
    label: "Shortlisted",
    description: "Your profile has been shortlisted for further consideration.",
  },
  {
    value: "ASSESSMENT_INTERVIEW",
    label: "Assessment / Interview",
    description: "You have been selected for an interview or skills assessment.",
  },
  {
    value: "REFERENCE_CHECKS",
    label: "Reference checks",
    description: "Reference checks are currently in progress.",
  },
  {
    value: "OFFER_MADE",
    label: "Offer made",
    description: "A formal job offer has been extended.",
  },
  {
    value: "HIRED",
    label: "Hired",
    description: "You have been successfully hired for this role. Welcome aboard!",
  },
  {
    value: "NOT_SELECTED",
    label: "Not selected",
    description: "Thank you for taking the time to apply. We have decided to proceed with other candidates.",
  },
  {
    value: "WITHDRAWN",
    label: "Withdrawn",
    description: "This application was withdrawn.",
  },
] as const

export type ApplicationStatusValue = typeof APPLICATION_STATUSES[number]["value"]

export const QUESTION_TYPES = [
  { value: "SHORT_TEXT", label: "Short text" },
  { value: "LONG_TEXT", label: "Long text" },
  { value: "SINGLE_CHOICE", label: "Single choice" },
  { value: "MULTIPLE_CHOICE", label: "Multiple choice" },
  { value: "YES_NO", label: "Yes / No" },
  { value: "URL", label: "URL / Link" },
] as const

export type QuestionTypeValue = typeof QUESTION_TYPES[number]["value"]

export interface VacancyQuestion {
  id: string
  label: string
  type: QuestionTypeValue
  required: boolean
  placeholder?: string
  options?: string[] // For single/multiple choice
  helpText?: string
}

export interface SubmittedAnswer {
  questionId: string
  questionLabel: string
  questionType: QuestionTypeValue
  value: string | string[] | boolean
}

export interface PublicTrackingResponse {
  referenceCode: string
  candidateDisplayName: string
  positionTitle: string
  opportunityType: string
  submittedAt: string
  status: ApplicationStatusValue
  statusLabel: string
  statusDescription: string
  lastStatusUpdateAt: string
}
