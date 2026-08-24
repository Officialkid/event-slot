import { useEffect, useMemo, useState } from "react";
import { BarcodeScanningResult, CameraView } from "expo-camera";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ORGANIZER_SURFACE_COPY } from "../../../lib/organizerSurfaceContent";
import { TIER_PRESETS } from "../../../lib/tierPresets";
import { NativeEventWorkspaceResponse } from "../api/contracts";
import { nativeConfig } from "../config";
import { EventSlotInfoRow } from "../components/EventSlotInfoRow";
import { EventSlotInsetCard } from "../components/EventSlotInsetCard";
import { EventSlotLinkStrip } from "../components/EventSlotLinkStrip";
import { EventSlotMessageCard } from "../components/EventSlotMessageCard";
import { EventSlotMetricGrid } from "../components/EventSlotMetricGrid";
import { EventSlotOutlineButton } from "../components/EventSlotOutlineButton";
import { EventSlotPageHeader } from "../components/EventSlotPageHeader";
import { EventSlotPill } from "../components/EventSlotPill";
import { EventSlotSectionCard } from "../components/EventSlotSectionCard";
import { EventSlotSegmentedOptions } from "../components/EventSlotSegmentedOptions";
import { EventSlotTabs } from "../components/EventSlotTabs";
import { MetricCard } from "../components/MetricCard";
import { EventSlotField } from "../components/EventSlotField";
import { EmailRecipientFilter, NativeEmailCampaignHistoryEntry } from "../domain/emailCampaigns";
import { NativeExportAction, NativeExportHistoryEntry, NativePreparedExport } from "../domain/exports";
import { NativeEventSettingsDraft, NativeEventTeamMember } from "../domain/eventManagement";
import { NativeInsightHistoryEntry } from "../domain/eventInsights";
import { NativeScanMode, NativeScannerState } from "../domain/scanner";
import { NativeVerificationHistoryEntry, NativeVerificationHistoryMethod, VerificationResult } from "../domain/verification";
import { copyTextToClipboard } from "../services/clipboard";
import { getEventAccessSummary, buildVerifierInviteAction, formatCapabilityLabel } from "../services/eventAccess";
import {
  clearNativeEmailCampaignHistory,
  getNativeEmailCampaignReadinessMessage,
  getRecipientCount,
  loadNativeEmailCampaignHistory,
  nativeEmailTemplates,
  saveNativeEmailCampaignHistoryEntry
} from "../services/emailCampaigns";
import { AnalyticsRange, buildEventAnalytics } from "../services/eventAnalytics";
import {
  getNativeEventManagementReadinessMessage,
  loadNativeEventSettingsDraft,
  persistNativeArchiveToggle,
  persistNativeCapacityUpdate,
  persistNativeDeleteToggle,
  persistNativeEventDuplicate,
  persistNativeEventSettingsDraft,
  persistNativeTicketTierUpdate,
  loadNativeEventTeamMembers,
  saveNativeEventSettingsDraft,
  saveNativeEventTeamMembers
} from "../services/eventManagement";
import {
  buildNativeInsightCards,
  clearNativeInsightHistory,
  getInsightQuotaPreview,
  getNativeInsightReadinessMessage,
  loadNativeInsightHistory,
  saveNativeInsightHistoryEntry
} from "../services/eventInsights";
import { findNativeEvent } from "../services/events";
import {
  clearNativeExportHistory,
  getNativeExportHistoryReadinessMessage,
  loadNativeExportHistory,
  saveNativeExportHistoryEntry
} from "../services/exportHistory";
import { buildExportActions, buildPreparedNativeExport, getExportReadinessMessage, openPreparedNativeExport, prepareNativeExport } from "../services/exports";
import { buildNativeMapAction, openMapUrl } from "../services/maps";
import { buildDemoRegistrationWorkspace, buildWorkspaceRegistrationPreview, mergeLocalPublicRegistrations } from "../services/registrations";
import {
  buildDemoScanPayload,
  buildNativeScanPayload,
  getCameraPermissionLabel,
  getScannerReadinessMessage,
  initialScannerState,
  requestCameraScannerAccess
} from "../services/scanner";
import { shareNativePayload } from "../services/share";
import { verifyNativeTicket } from "../services/verification";
import {
  clearNativeVerificationHistory,
  getVerificationHistoryReadinessMessage,
  loadNativeVerificationHistory,
  saveNativeVerificationHistoryEntry
} from "../services/verificationHistory";
import { loadPublicRegistrationRecords } from "../services/publicRegistrations";
import { loadNativeEventWorkspace, mergeNativeEventWorkspace } from "../services/workspace";
import { EventDetailScreenProps, EventDetailTab } from "./types";

export function EventDetailScreen({
  eventId,
  initialTab = "overview",
  theme,
  session,
  navigate,
  events,
  eventsLoading,
  eventsError,
  refreshEvents
}: EventDetailScreenProps) {
  const event = findNativeEvent(events, eventId);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [preparedExport, setPreparedExport] = useState<NativePreparedExport | null>(null);
  const [exportHistory, setExportHistory] = useState<NativeExportHistoryEntry[]>([]);
  const [workspace, setWorkspace] = useState<NativeEventWorkspaceResponse | null>(null);
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EventDetailTab>(initialTab);
  const [linkShared, setLinkShared] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [checkInLookup, setCheckInLookup] = useState("");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [scannerState, setScannerState] = useState<NativeScannerState>(initialScannerState);
  const [checkInResult, setCheckInResult] = useState<VerificationResult | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<NativeVerificationHistoryEntry[]>([]);
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [campaignRecipientFilter, setCampaignRecipientFilter] = useState<EmailRecipientFilter>("all");
  const [campaignStatus, setCampaignStatus] = useState("Draft an attendee message for this event.");
  const [campaignHistory, setCampaignHistory] = useState<NativeEmailCampaignHistoryEntry[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>("30d");
  const [insightCards, setInsightCards] = useState<ReturnType<typeof buildNativeInsightCards>>([]);
  const [insightStatus, setInsightStatus] = useState("Generate event-specific insight cards from the current analytics snapshot.");
  const [insightHistory, setInsightHistory] = useState<NativeInsightHistoryEntry[]>([]);
  const [settingsDraft, setSettingsDraft] = useState<NativeEventSettingsDraft | null>(null);
  const [settingsStatus, setSettingsStatus] = useState("Local event settings are ready to stage.");
  const [teamMembers, setTeamMembers] = useState<NativeEventTeamMember[]>([]);
  const [teamInviteEmail, setTeamInviteEmail] = useState("");
  const [teamInviteRole, setTeamInviteRole] = useState<"Editor" | "Viewer">("Viewer");
  const [teamStatus, setTeamStatus] = useState("Invite event collaborators and stage role changes locally.");
  const [localPublicRecords, setLocalPublicRecords] = useState<import("../domain/publicRegistrations").NativePublicRegistrationRecord[]>([]);
  const [attendeeSearchQuery, setAttendeeSearchQuery] = useState("");
  const [promotedWaitlistIds, setPromotedWaitlistIds] = useState<string[]>([]);
  const [attendeeListStatus, setAttendeeListStatus] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;

    setWorkspace(null);
    setWorkspaceStatus(null);

    if (!event || session.authMode !== "live") {
      return () => {
        mounted = false;
      };
    }

    setWorkspaceStatus("Loading live event workspace...");
    loadNativeEventWorkspace(session, event.slug)
      .then((response) => {
        if (!mounted) {
          return;
        }
        setWorkspace(response);
        setWorkspaceStatus("Live workspace loaded from EventSlot.");
      })
      .catch((error: unknown) => {
        if (!mounted) {
          return;
        }
        setWorkspaceStatus(error instanceof Error ? error.message : "Could not load the live event workspace.");
      });

    return () => {
      mounted = false;
    };
  }, [event, session]);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setExportHistory([]);
      return () => {
        mounted = false;
      };
    }

    loadNativeExportHistory(event.slug)
      .then((history) => {
        if (mounted) {
          setExportHistory(history);
        }
      })
      .catch(() => {
        if (mounted) {
          setExportHistory([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event]);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setLocalPublicRecords([]);
      return () => {
        mounted = false;
      };
    }

    loadPublicRegistrationRecords(event.slug)
      .then((records) => {
        if (mounted) {
          setLocalPublicRecords(records);
        }
      })
      .catch(() => {
        if (mounted) {
          setLocalPublicRecords([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event]);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setSettingsDraft(null);
      return () => {
        mounted = false;
      };
    }

    loadNativeEventSettingsDraft(workspace ? mergeNativeEventWorkspace(event, workspace) : event, workspace)
      .then((draft) => {
        if (mounted) {
          setSettingsDraft(draft);
        }
      })
      .catch(() => {
        if (mounted) {
          setSettingsDraft(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event, workspace]);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setTeamMembers([]);
      return () => {
        mounted = false;
      };
    }

    loadNativeEventTeamMembers(event)
      .then((members) => {
        if (mounted) {
          setTeamMembers(members);
        }
      })
      .catch(() => {
        if (mounted) {
          setTeamMembers([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event]);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setInsightHistory([]);
      setInsightCards([]);
      return () => {
        mounted = false;
      };
    }

    loadNativeInsightHistory(event.slug)
      .then((history) => {
        if (mounted) {
          setInsightHistory(history);
          if (history[0]) {
            setInsightCards(history[0].cards);
          }
        }
      })
      .catch(() => {
        if (mounted) {
          setInsightHistory([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event]);

  useEffect(() => {
    let mounted = true;

    loadNativeVerificationHistory()
      .then((history) => {
        if (mounted) {
          setVerificationHistory(history);
        }
      })
      .catch(() => {
        if (mounted) {
          setVerificationHistory([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!event) {
      setCampaignHistory([]);
      return () => {
        mounted = false;
      };
    }

    loadNativeEmailCampaignHistory(event.slug)
      .then((history) => {
        if (mounted) {
          setCampaignHistory(history);
        }
      })
      .catch(() => {
        if (mounted) {
          setCampaignHistory([]);
        }
      });

    return () => {
      mounted = false;
    };
  }, [event]);

  if (eventsLoading) {
    return (
      <View style={styles.stack}>
        <EventSlotPageHeader
          theme={theme}
          title="Loading event"
          backLabel={ORGANIZER_SURFACE_COPY.eventDetail.backLabel}
          onBackPress={() => navigate({ name: "events" })}
        />
        <EventSlotMessageCard
          title="Loading event"
          caption="We are opening the event workspace."
          theme={theme}
        />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.stack}>
        <EventSlotPageHeader
          theme={theme}
          title="Event unavailable"
          backLabel={ORGANIZER_SURFACE_COPY.eventDetail.backLabel}
          onBackPress={() => navigate({ name: "events" })}
        />
        <EventSlotMessageCard
          title="Event unavailable"
          caption={eventsError ?? "This event could not be found in your EventSlot workspace."}
          theme={theme}
          actionLabel="Refresh events"
          onActionPress={refreshEvents}
        />
      </View>
    );
  }

  const capacityDisplay = event.capacity > 0 ? `${event.capacity}` : "Unlimited";
  const mapAction = buildNativeMapAction({
    mapDirectionsUrl: event.mapDirectionsUrl,
    venue: event.venue
  });
  const baseRegistrationWorkspace = workspace ? buildWorkspaceRegistrationPreview(workspace) : buildDemoRegistrationWorkspace(event);
  const mergedRegistrationWorkspace = mergeLocalPublicRegistrations(baseRegistrationWorkspace, localPublicRecords);
  const registrationWorkspace = useMemo(
    () => applyPromotedWaitlist(mergedRegistrationWorkspace, promotedWaitlistIds),
    [mergedRegistrationWorkspace, promotedWaitlistIds]
  );
  const filteredConfirmedRegistrations = filterRegistrationPreviews(registrationWorkspace.confirmed, attendeeSearchQuery);
  const filteredWaitlistRegistrations = filterRegistrationPreviews(registrationWorkspace.waitlist, attendeeSearchQuery);
  const confirmedCount = registrationWorkspace.confirmed.length;
  const waitlistCount = registrationWorkspace.waitlist.length;
  const fillPercent = event.capacity > 0 ? Math.round((confirmedCount / event.capacity) * 100) : 0;
  const slotsRemaining = event.capacity > 0 ? Math.max(0, event.capacity - confirmedCount) : null;
  const slotsRemainingDisplay = slotsRemaining === null ? "Unlimited" : `${slotsRemaining}`;
  const exportActions = buildExportActions(event);
  const confirmedCsvAction = exportActions.find((action) => action.kind === "confirmed-csv");
  const responsesPdfAction = exportActions.find((action) => action.kind === "responses-pdf");
  const accessSummary = getEventAccessSummary(event);
  const verifierInvite = buildVerifierInviteAction(event);
  const registrationUrl = buildEventRegistrationUrl(event.slug);
  const eventSummaryLine = `${confirmedCount} confirmed | ${waitlistCount} waitlisted | ${event.capacity > 0 ? `${event.capacity} capacity` : "Unlimited"}`;
  const eventSupportLine = [
    event.paymentMode,
    mapAction.ready ? "Directions ready" : "Directions pending",
    workspace ? "Live workspace connected" : "Preview workspace"
  ].join(" | ");
  const detailTabs = [
    { key: "overview", label: ORGANIZER_SURFACE_COPY.eventDetail.tabs.overview },
    { key: "confirmed", label: ORGANIZER_SURFACE_COPY.eventDetail.tabs.confirmed, count: confirmedCount },
    { key: "waitlist", label: ORGANIZER_SURFACE_COPY.eventDetail.tabs.waitlist, count: waitlistCount },
    { key: "checkin", label: "Check-In" },
    { key: "email", label: "Email" },
    { key: "analytics", label: "Analytics" },
    { key: "insights", label: "AI Insights" },
    { key: "settings", label: "Settings" },
    { key: "team", label: "Team" },
    { key: "exports", label: ORGANIZER_SURFACE_COPY.eventDetail.tabs.exports }
  ] as const;
  const headerMeta = [
    event.dateLabel,
    event.timeLabel,
    event.venue,
    event.whatsappNumber ? `WhatsApp ${event.whatsappNumber}` : undefined
  ].filter(Boolean);
  const paidEvent = event.monetization === "paid" || event.paymentMode !== "Registration only";
  const eventVerificationHistory = useMemo(
    () => verificationHistory.filter((entry) => entry.eventSlug === event.slug),
    [event.slug, verificationHistory]
  );
  const campaignRecipientCount = getRecipientCount(registrationWorkspace, campaignRecipientFilter);
  const analytics = useMemo(() => buildEventAnalytics(event, workspace, analyticsRange), [analyticsRange, event, workspace]);
  const insightQuota = getInsightQuotaPreview(session);

  const handlePrepareExport = async (action: NativeExportAction) => {
    setExportStatus(`Preparing ${action.title.toLowerCase()}...`);
    setPreparedExport(null);

    try {
      const result = await prepareNativeExport(session, event, action);
      const prepared = buildPreparedNativeExport(action, result);

      setPreparedExport(prepared);
      setExportStatus(prepared.message);
      const nextHistory = await saveNativeExportHistoryEntry(exportHistory, event, prepared);
      setExportHistory(nextHistory);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Could not prepare this export right now.");
    }
  };

  const handleOpenPreparedExport = async () => {
    if (!preparedExport) {
      return;
    }

    const result = await openPreparedNativeExport(preparedExport);
    setExportStatus(result.message);
  };

  const handleSharePreparedExport = async () => {
    if (!preparedExport?.downloadUrl) {
      setExportStatus("Prepare a downloadable export before sharing.");
      return;
    }

    const shared = await shareNativePayload({
      title: preparedExport.title,
      message: preparedExport.message,
      url: preparedExport.downloadUrl
    });

    setExportStatus(shared ? "Shared the prepared export link." : "Export share sheet was closed.");
  };

  const handleClearExportHistory = async () => {
    await clearNativeExportHistory(event.slug);
    setExportHistory([]);
    setExportStatus("Cleared prepared export history on this device.");
  };

  const handleShareRegistrationLink = async () => {
    const shared = await shareNativePayload({
      title: event.title,
      message: `Register for ${event.title}`,
      url: registrationUrl
    });

    setLinkShared(shared);
    if (shared) {
      setTimeout(() => setLinkShared(false), 2000);
    }
  };

  const handleCopyRegistrationLink = async () => {
    const copied = await copyTextToClipboard(registrationUrl);
    setLinkCopied(copied);

    if (copied) {
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handlePromoteWaitlistRegistration = (registrationId: string, attendeeName: string) => {
    setPromotedWaitlistIds((current) => (current.includes(registrationId) ? current : [...current, registrationId]));
    setAttendeeListStatus(`${attendeeName} was promoted into confirmed attendees on this device preview.`);
  };

  const runCheckInVerification = async (
    input: { ticketCode?: string; qrPayload?: string },
    method: NativeVerificationHistoryMethod
  ) => {
    setCheckInLoading(true);
    setCheckInResult(null);

    try {
      const verification = await verifyNativeTicket(session, event, input);
      setCheckInResult(verification);
      const nextHistory = await saveNativeVerificationHistoryEntry(verificationHistory, {
        event,
        lookupValue: input.ticketCode ?? input.qrPayload ?? "",
        method,
        result: verification
      });
      setVerificationHistory(nextHistory);
    } catch (error) {
      const errorResult: VerificationResult = {
        status: "error",
        message: error instanceof Error ? error.message : "Could not verify this ticket right now."
      };
      setCheckInResult(errorResult);
      const nextHistory = await saveNativeVerificationHistoryEntry(verificationHistory, {
        event,
        lookupValue: input.ticketCode ?? input.qrPayload ?? "",
        method,
        result: errorResult
      });
      setVerificationHistory(nextHistory);
    } finally {
      setCheckInLoading(false);
    }
  };

  const handleCheckInModeChange = async (mode: NativeScanMode) => {
    if (mode === "camera") {
      const nextScannerState = await requestCameraScannerAccess();
      setScannerState(nextScannerState);
    } else {
      setScannerState((current) => ({ ...current, activeMode: "manual" }));
    }
    setCheckInResult(null);
  };

  const handlePreviewScan = async () => {
    const payload = buildDemoScanPayload(checkInLookup);
    setScannerState((current) => ({
      ...current,
      activeMode: "camera",
      lastPayload: payload
    }));
    await runCheckInVerification({ qrPayload: payload.rawValue }, "preview");
  };

  const handleBarcodeScanned = async (scanResult: BarcodeScanningResult) => {
    if (checkInLoading || scanLocked || !scanResult.data) {
      return;
    }

    const payload = buildNativeScanPayload(scanResult);
    setScanLocked(true);
    setScannerState((current) => ({
      ...current,
      activeMode: "camera",
      lastPayload: payload
    }));

    await runCheckInVerification({ qrPayload: payload.rawValue }, "camera");
    setTimeout(() => setScanLocked(false), 1800);
  };

  const handleManualCheckIn = async () => {
    await runCheckInVerification({ ticketCode: checkInLookup }, "manual");
  };

  const handleClearCheckInHistory = async () => {
    await clearNativeVerificationHistory();
    setVerificationHistory([]);
  };

  const handleApplyEmailTemplate = (templateId: string) => {
    const template = nativeEmailTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setCampaignSubject(template.subject);
    setCampaignMessage(template.message);
    setCampaignRecipientFilter(template.recipientFilter);
    setCampaignStatus(`Template loaded: ${template.label}.`);
  };

  const handleSendCampaign = async () => {
    if (!campaignSubject.trim() || !campaignMessage.trim()) {
      setCampaignStatus("Add both a subject and a message before sending this campaign preview.");
      return;
    }

    if (campaignRecipientCount === 0) {
      setCampaignStatus("There are no recipients in the selected audience yet.");
      return;
    }

    const matchedTemplate = nativeEmailTemplates.find(
      (template) => template.subject === campaignSubject && template.message === campaignMessage
    );
    const nextHistory = await saveNativeEmailCampaignHistoryEntry(campaignHistory, {
      eventSlug: event.slug,
      subject: campaignSubject,
      message: campaignMessage,
      recipientFilter: campaignRecipientFilter,
      recipientCount: campaignRecipientCount,
      templateLabel: matchedTemplate?.label
    });

    setCampaignHistory(nextHistory);
    setCampaignStatus(`Campaign saved for ${campaignRecipientCount} recipient${campaignRecipientCount === 1 ? "" : "s"} in the ${campaignRecipientFilter} audience.`);
  };

  const handleClearCampaignHistory = async () => {
    await clearNativeEmailCampaignHistory();
    setCampaignHistory([]);
    setCampaignStatus("Cleared local campaign history.");
  };

  const handleGenerateInsights = async () => {
    const used = Math.min(insightQuota.limit === 999 ? 0 : insightQuota.used + 1, insightQuota.limit);
    const cards = buildNativeInsightCards(event, analytics);
    const nextHistory = await saveNativeInsightHistoryEntry({
      eventSlug: event.slug,
      cards,
      quotaUsed: used,
      quotaLimit: insightQuota.limit
    });

    setInsightCards(cards);
    setInsightHistory(nextHistory);
    setInsightStatus(`Generated ${cards.length} insight cards for ${event.title}.`);
  };

  const handleClearInsights = async () => {
    await clearNativeInsightHistory();
    setInsightHistory([]);
    setInsightCards([]);
    setInsightStatus("Cleared local insight history.");
  };

  const handleSaveSettingsDraft = async () => {
    if (!settingsDraft) {
      return;
    }

    const result = await persistNativeEventSettingsDraft(session, settingsDraft);
    setSettingsDraft(result.draft);
    setSettingsStatus(result.message);
    if (result.mode === "live") {
      refreshEvents();
    }
  };

  const handleSaveCapacity = async () => {
    if (!settingsDraft) {
      return;
    }

    const result = await persistNativeCapacityUpdate(session, settingsDraft);
    setSettingsDraft(result.draft);
    setSettingsStatus(result.message);
    if (result.mode === "live") {
      refreshEvents();
      setAttendeeListStatus(
        result.promoted && result.promoted > 0
          ? `${result.promoted} waitlisted attendee${result.promoted === 1 ? "" : "s"} were promoted after the capacity update.`
          : null
      );
    }
  };

  const handleTierDraftChange = (tierId: string, key: "name" | "price" | "capacity" | "description" | "bundleSize", value: string) => {
    if (!settingsDraft) {
      return;
    }

    const normalizedValue = key === "name" || key === "description" ? value : value.replace(/[^0-9]/g, "");
    setSettingsDraft({
      ...settingsDraft,
      ticketTiers: settingsDraft.ticketTiers.map((tier) => (tier.id === tierId ? { ...tier, [key]: normalizedValue } : tier))
    });
    setSettingsStatus("Ticket tier draft updated locally.");
  };

  const handleTierPresetChange = (tierId: string, presetKey: string | null) => {
    if (!settingsDraft) {
      return;
    }

    const preset = presetKey ? TIER_PRESETS.find((item) => item.key === presetKey) : null;
    setSettingsDraft({
      ...settingsDraft,
      ticketTiers: settingsDraft.ticketTiers.map((tier) =>
        tier.id === tierId
          ? {
              ...tier,
              presetKey: preset?.key,
              badgeColor: preset?.badgeColor ?? tier.badgeColor,
              textColor: preset?.textColor ?? tier.textColor,
              metallic: preset?.metallic ?? tier.metallic,
              prestige: preset?.prestige ?? tier.prestige,
              name: preset && !tier.name.trim() ? preset.defaultName : tier.name
            }
          : tier
      )
    });
    setSettingsStatus(preset ? `Applied the ${preset.defaultName} tier preset locally.` : "Cleared the tier preset locally.");
  };

  const handleAddTicketTierDraft = () => {
    if (!settingsDraft) {
      return;
    }

    setSettingsDraft({
      ...settingsDraft,
      ticketTiers: [
        ...settingsDraft.ticketTiers,
        { id: `new-tier-${Date.now()}`, name: "", price: "", capacity: "", description: "", bundleSize: "1" }
      ]
    });
    setSettingsStatus("Added a new paid ticket tier draft.");
  };

  const handleRemoveTicketTierDraft = (tierId: string) => {
    if (!settingsDraft) {
      return;
    }

    setSettingsDraft({
      ...settingsDraft,
      ticketTiers: settingsDraft.ticketTiers.filter((tier) => tier.id !== tierId)
    });
    setSettingsStatus("Removed that paid ticket tier draft.");
  };

  const handleSaveTicketTiers = async () => {
    if (!settingsDraft) {
      return;
    }

    const result = await persistNativeTicketTierUpdate(session, settingsDraft);
    setSettingsDraft(result.draft);
    setSettingsStatus(result.message);
    if (result.mode === "live") {
      refreshEvents();
    }
  };

  const handleMarkDuplicate = async () => {
    if (!settingsDraft) {
      return;
    }

    const result = await persistNativeEventDuplicate(session, settingsDraft);
    setSettingsDraft(result.draft);
    setSettingsStatus(result.message);
    if (result.mode === "live") {
      refreshEvents();
    }
  };

  const handleArchiveToggle = async () => {
    if (!settingsDraft) {
      return;
    }

    const result = await persistNativeArchiveToggle(session, settingsDraft);
    setSettingsDraft(result.draft);
    setSettingsStatus(result.message);
    if (result.mode === "live") {
      refreshEvents();
    }
  };

  const handleDeleteToggle = async () => {
    if (!settingsDraft) {
      return;
    }

    const result = await persistNativeDeleteToggle(session, settingsDraft);
    setSettingsDraft(result.draft);
    setSettingsStatus(result.message);
    if (result.mode === "live" && result.draft.deleted) {
      refreshEvents();
      navigate({ name: "events" });
      return;
    }
    if (result.mode === "live") {
      refreshEvents();
    }
  };

  const handleInviteTeamMember = async () => {
    const trimmedEmail = teamInviteEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setTeamStatus("Enter an email address before adding a team member.");
      return;
    }

    const nextMembers = await saveNativeEventTeamMembers(event.slug, [
      ...teamMembers,
      {
        id: `${event.slug}-${Date.now()}`,
        email: trimmedEmail,
        role: teamInviteRole,
        status: "Pending",
        addedAt: new Date().toISOString()
      }
    ]);
    setTeamMembers(nextMembers);
    setTeamInviteEmail("");
    setTeamStatus(`Added a ${teamInviteRole.toLowerCase()} invite for ${trimmedEmail}.`);
  };

  const handleRemoveTeamMember = async (memberId: string) => {
    const nextMembers = await saveNativeEventTeamMembers(
      event.slug,
      teamMembers.filter((member) => member.id !== memberId)
    );
    setTeamMembers(nextMembers);
    setTeamStatus("Removed that member from the local event team list.");
  };

  const handleToggleTeamRole = async (memberId: string) => {
    const nextMembers = await saveNativeEventTeamMembers(
      event.slug,
      teamMembers.map((member) =>
        member.id === memberId
          ? { ...member, role: member.role === "Editor" ? "Viewer" : "Editor" }
          : member
      )
    );
    setTeamMembers(nextMembers);
    setTeamStatus("Updated the local role assignment for that event teammate.");
  };

  return (
    <View style={styles.stack}>
      <EventSlotPageHeader
        theme={theme}
        backLabel={ORGANIZER_SURFACE_COPY.eventDetail.backLabel}
        onBackPress={() => navigate({ name: "events" })}
        title={event.title}
        caption={[event.dateLabel, event.timeLabel, event.venue].filter(Boolean).join(" | ")}
        actionLabel="Verify tickets"
        onActionPress={() => navigate({ name: "verify" })}
        trailingSlot={<EventSlotPill label={event.status} theme={theme} style={styles.statusBadge} />}
      />

      <EventSlotSectionCard
        title={ORGANIZER_SURFACE_COPY.eventDetail.sections.eventAccess.title}
        caption={ORGANIZER_SURFACE_COPY.eventDetail.sections.eventAccess.caption}
        theme={theme}
        tone="hero"
      >
        <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{eventSummaryLine}</Text>
        <View style={styles.metaWrap}>
          {headerMeta.map((item) => (
            <Text
              key={item}
              style={[styles.metaPill, { backgroundColor: theme.colors.input, borderColor: theme.colors.border, color: theme.colors.secondary }]}
            >
              {item}
            </Text>
          ))}
          <EventSlotPill label={event.role} theme={theme} tone="text" background="elevated" />
          {paidEvent ? <EventSlotPill label="PAID" theme={theme} tone="accent" /> : null}
          <EventSlotPill label={event.paymentMode} theme={theme} tone="text" background="elevated" />
        </View>

        <View style={styles.headerActions}>
          <EventSlotOutlineButton
            label="Share event"
            theme={theme}
            onPress={() =>
              shareNativePayload({
                title: event.title,
                message: `${event.title}\n${event.dateLabel} | ${event.timeLabel}\n${event.venue}`
              }).catch(() => {})
            }
            style={styles.headerActionButton}
          />
          <EventSlotOutlineButton
            label="Open exports"
            theme={theme}
            tone="text"
            onPress={() => setActiveTab("exports")}
            style={styles.headerActionButton}
          />
          {mapAction.ready ? (
            <EventSlotOutlineButton
              label={mapAction.label}
              theme={theme}
              onPress={() => openMapUrl(mapAction.url)}
              style={styles.headerActionButton}
            />
          ) : null}
        </View>

        <EventSlotLinkStrip
          theme={theme}
          url={registrationUrl}
          actions={[
            {
              key: "share",
              label: linkShared ? "Shared" : "Share",
              onPress: handleShareRegistrationLink
            },
            {
              key: "copy",
              label: linkCopied ? "Copied" : "Copy",
              onPress: handleCopyRegistrationLink
            },
            {
              key: "verify",
              label: "Verify",
              onPress: () => navigate({ name: "verify" }),
              tone: "text"
            },
            {
              key: "exports",
              label: "Exports",
              onPress: () => setActiveTab("exports"),
              tone: "text"
            }
          ]}
          style={styles.heroLinkStrip}
        />
      </EventSlotSectionCard>

      <EventSlotTabs items={detailTabs.map((tab) => ({ ...tab }))} activeKey={activeTab} onSelect={setActiveTab} theme={theme} />

      {activeTab === "overview" ? (
        <>
          <EventSlotMetricGrid>
            <MetricCard label="Confirmed" value={`${confirmedCount}`} trend={`${fillPercent}% full`} theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
            <MetricCard label="Waitlist" value={`${waitlistCount}`} trend="Auto promote later" theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
            <MetricCard label="Capacity" value={capacityDisplay} trend={event.paymentMode} theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
            <MetricCard
              label="Slots remaining"
              value={slotsRemainingDisplay}
              trend={slotsRemaining === null ? "Open capacity" : slotsRemaining === 0 ? "Event is full" : "Before waitlist promotion"}
              theme={theme}
              valueWeight="400"
              valueSize={28}
              trendSize={12}
            />
          </EventSlotMetricGrid>

          <EventSlotSectionCard title={ORGANIZER_SURFACE_COPY.eventDetail.sections.overview} theme={theme}>
            <ActionLine label="Event summary" value={eventSummaryLine} theme={theme} />
            <ActionLine label="Event support" value={eventSupportLine} theme={theme} />
            <ActionLine
              label="Workspace source"
              value={workspaceStatus ?? (session.authMode === "live" ? "Preparing live event workspace..." : "Preparing event workspace preview.")}
              theme={theme}
            />
            <ActionLine label="Registrations" value={workspace ? "Loaded confirmed and waitlist records from the live API" : "View confirmed, waitlist, and attendee records"} theme={theme} />
            <ActionLine label="Access role" value={accessSummary.caption} theme={theme} />
            <ActionLine
              label="Maps"
              value={mapAction.source === "organiser-link" ? "Organiser-provided directions are ready" : mapAction.source === "venue-search" ? "No organiser link yet; EventSlot can search the venue on Maps." : "Add organiser-provided directions before launch"}
              action={mapAction.ready ? mapAction.label : undefined}
              onPress={mapAction.ready ? () => openMapUrl(mapAction.url) : undefined}
              theme={theme}
            />
          </EventSlotSectionCard>

          <EventSlotSectionCard
            title={ORGANIZER_SURFACE_COPY.eventDetail.sections.exportCentre.title}
            caption={ORGANIZER_SURFACE_COPY.eventDetail.sections.exportCentre.caption}
            theme={theme}
          >
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {preparedExport?.message ?? getExportReadinessMessage(event)}
            </Text>
            <View style={styles.overviewActionRow}>
              <EventSlotOutlineButton label="Open exports" theme={theme} onPress={() => setActiveTab("exports")} style={styles.inlineActionButton} />
              <EventSlotOutlineButton
                label="Share link"
                theme={theme}
                onPress={handleShareRegistrationLink}
                tone="text"
                style={styles.inlineActionButton}
              />
            </View>
          </EventSlotSectionCard>

          <EventSlotSectionCard
            title="Capacity"
            caption="Match the overview logic from the web dashboard before changing capacity tools."
            theme={theme}
          >
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {slotsRemaining === null
                ? "This event is open capacity, so new registrations do not hit a slot limit."
                : slotsRemaining === 0
                  ? "The event is full. New attendees should move to waitlist until capacity changes."
                  : `${slotsRemaining} slot${slotsRemaining === 1 ? "" : "s"} remain before new signups spill into waitlist.`}
            </Text>
            <View style={styles.overviewActionRow}>
              <EventSlotOutlineButton label="View waitlist" theme={theme} onPress={() => setActiveTab("waitlist")} style={styles.inlineActionButton} />
              <EventSlotOutlineButton label="Verify tickets" theme={theme} onPress={() => navigate({ name: "verify" })} tone="text" style={styles.inlineActionButton} />
            </View>
          </EventSlotSectionCard>

          <EventSlotSectionCard title="Team access" theme={theme}>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{accessSummary.title}</Text>
            <View style={styles.capabilityRow}>
              {accessSummary.capabilities.map((capability) => (
                <EventSlotPill key={capability} label={formatCapabilityLabel(capability)} theme={theme} style={styles.capabilityPill} />
              ))}
            </View>
            <EventSlotInsetCard theme={theme} style={styles.verifierCard}>
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{verifierInvite.title}</Text>
              <Text style={[styles.verifierCode, { color: theme.colors.accent }]}>{verifierInvite.verifierCode}</Text>
              <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{verifierInvite.caption}</Text>
              <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{verifierInvite.shareLabel}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  shareNativePayload({
                    title: verifierInvite.title,
                    message: verifierInvite.shareLabel
                  }).catch(() => {})
                }
                style={styles.shareButton}
              >
                <Text style={[styles.headerActionText, { color: theme.colors.accent }]}>Share verifier code</Text>
              </Pressable>
            </EventSlotInsetCard>
          </EventSlotSectionCard>
        </>
      ) : null}

      {activeTab === "exports" ? (
        <EventSlotSectionCard title={ORGANIZER_SURFACE_COPY.eventDetail.sections.exportCentre.title} theme={theme}>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            {getExportReadinessMessage(event)}
          </Text>
          {exportStatus ? (
            <Text style={[styles.exportStatus, { color: theme.colors.accent }]}>{exportStatus}</Text>
          ) : null}
          {preparedExport ? (
            <EventSlotInsetCard theme={theme} style={styles.preparedExportCard}>
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{preparedExport.title}</Text>
              <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{preparedExport.message}</Text>
              {preparedExport.downloadUrl ? (
                <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{preparedExport.downloadUrl}</Text>
              ) : null}
              <View style={styles.preparedExportActions}>
                <EventSlotOutlineButton label="Open export" theme={theme} disabled={!preparedExport.downloadUrl} onPress={handleOpenPreparedExport} style={styles.shareButton} />
                <EventSlotOutlineButton label="Share link" theme={theme} disabled={!preparedExport.downloadUrl} onPress={handleSharePreparedExport} style={styles.shareButton} />
              </View>
            </EventSlotInsetCard>
          ) : null}
          <View style={styles.exportGrid}>
            {exportActions.map((action) => (
              <ExportActionCard key={action.kind} action={action} onPrepare={() => handlePrepareExport(action)} theme={theme} />
            ))}
          </View>
          <EventSlotInsetCard theme={theme} style={styles.exportHistoryCard}>
            <View style={styles.exportHistoryHeader}>
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Recent exports</Text>
              <EventSlotOutlineButton label="Clear" theme={theme} onPress={handleClearExportHistory} style={styles.clearButton} />
            </View>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {getNativeExportHistoryReadinessMessage()}
            </Text>
            {exportHistory.length === 0 ? (
              <Text style={[styles.actionValue, { color: theme.colors.muted }]}>
                No prepared exports saved on this device for this event yet.
              </Text>
            ) : (
              exportHistory.slice(0, 4).map((entry) => (
                <View key={entry.id} style={[styles.exportHistoryItem, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{entry.title}</Text>
                  <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                    {entry.status.toUpperCase()} - {formatExportHistoryTime(entry.preparedAt)}
                  </Text>
                  {entry.downloadUrl ? (
                    <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{entry.downloadUrl}</Text>
                  ) : null}
                </View>
              ))
            )}
          </EventSlotInsetCard>
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "confirmed" ? (
        <EventSlotSectionCard title={ORGANIZER_SURFACE_COPY.eventDetail.sections.confirmedRegistrations} theme={theme}>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            {workspace
              ? "These attendee previews are loaded from the live event workspace API."
              : "Attendee previews will appear here when the live workspace is available."}
          </Text>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Export attendee list</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              Prepare the most common organizer exports directly from confirmed attendees, then use the exports tab for the full handoff history.
            </Text>
            <View style={styles.lookupActionRow}>
              <EventSlotOutlineButton
                label="Confirmed CSV"
                theme={theme}
                onPress={confirmedCsvAction ? () => handlePrepareExport(confirmedCsvAction) : undefined}
                disabled={!confirmedCsvAction}
                style={styles.inlineActionButton}
              />
              <EventSlotOutlineButton
                label="Responses PDF"
                theme={theme}
                onPress={responsesPdfAction ? () => handlePrepareExport(responsesPdfAction) : undefined}
                disabled={!responsesPdfAction}
                style={styles.inlineActionButton}
              />
              <EventSlotOutlineButton
                label="Open exports"
                theme={theme}
                tone="text"
                onPress={() => setActiveTab("exports")}
                style={styles.inlineActionButton}
              />
            </View>
          </EventSlotInsetCard>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Search attendees</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setAttendeeSearchQuery}
              placeholder="Search by name, email, phone, or ticket code"
              placeholderTextColor={theme.colors.muted}
              style={[styles.lookupInputWrap, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.input }]}
              value={attendeeSearchQuery}
            />
          </EventSlotInsetCard>
          {filteredConfirmedRegistrations.length > 0 ? (
            filteredConfirmedRegistrations.map((registration) => (
              <RegistrationLine
                key={registration.id}
                registration={registration}
                theme={theme}
                onPress={() => navigate({ name: "registrationDetail", eventSlug: event.slug, registrationId: registration.id })}
              />
            ))
          ) : registrationWorkspace.confirmed.length > 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.secondary }]}>No confirmed attendees match this search yet.</Text>
          ) : (
            <Text style={[styles.emptyText, { color: theme.colors.secondary }]}>No confirmed attendees yet.</Text>
          )}
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "waitlist" ? (
        <EventSlotSectionCard title={ORGANIZER_SURFACE_COPY.eventDetail.sections.waitlist.title} theme={theme}>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            {ORGANIZER_SURFACE_COPY.eventDetail.sections.waitlist.caption}
          </Text>
          {attendeeListStatus ? <Text style={[styles.exportStatus, { color: theme.colors.accent }]}>{attendeeListStatus}</Text> : null}
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Search attendees</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setAttendeeSearchQuery}
              placeholder="Search by name, email, phone, or ticket code"
              placeholderTextColor={theme.colors.muted}
              style={[styles.lookupInputWrap, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.input }]}
              value={attendeeSearchQuery}
            />
          </EventSlotInsetCard>
          {filteredWaitlistRegistrations.length > 0 ? (
            filteredWaitlistRegistrations.map((registration) => (
              <RegistrationLine
                key={registration.id}
                registration={registration}
                theme={theme}
                onPress={() => navigate({ name: "registrationDetail", eventSlug: event.slug, registrationId: registration.id })}
                actionLabel="Promote"
                onActionPress={() => handlePromoteWaitlistRegistration(registration.id, registration.attendeeName)}
              />
            ))
          ) : registrationWorkspace.waitlist.length > 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.secondary }]}>No waitlist attendees match this search yet.</Text>
          ) : (
            <Text style={[styles.emptyText, { color: theme.colors.secondary }]}>{ORGANIZER_SURFACE_COPY.eventDetail.sections.waitlist.empty}</Text>
          )}
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "checkin" ? (
        <EventSlotSectionCard title="Check-In" caption="Reserve this route for the QR scanner and manual attendee lookup flow from the brief." theme={theme}>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            Check-in counter: {confirmedCount} confirmed attendee{confirmedCount === 1 ? "" : "s"} ready for verification.
          </Text>
          <View style={styles.modeRow}>
            <CheckInModeButton label="Manual" mode="manual" activeMode={scannerState.activeMode} onPress={() => handleCheckInModeChange("manual")} theme={theme} />
            <CheckInModeButton label="Camera" mode="camera" activeMode={scannerState.activeMode} onPress={() => handleCheckInModeChange("camera")} theme={theme} />
          </View>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            {getScannerReadinessMessage()}
          </Text>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
            Camera permission: {getCameraPermissionLabel(scannerState)}
          </Text>
          {scannerState.activeMode === "camera" && scannerState.cameraReady ? (
            <View style={[styles.cameraFrame, { borderColor: theme.colors.accent }]}>
              <CameraView
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                facing="back"
                onBarcodeScanned={scanLocked ? undefined : handleBarcodeScanned}
                style={styles.cameraView}
              />
              <View style={styles.scanGuide}>
                <Text style={styles.scanGuideText}>{scanLocked ? "Checking ticket..." : "Place QR inside the frame"}</Text>
              </View>
            </View>
          ) : null}
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Manual lookup</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              Search by ticket code, attendee name, or email for fast event-day fallback.
            </Text>
            <TextInput
              autoCapitalize="characters"
              onChangeText={(value) => {
                setCheckInLookup(value);
                setCheckInResult(null);
              }}
              placeholder="Enter ticket code, attendee name, or email"
              placeholderTextColor={theme.colors.muted}
              style={[styles.lookupInputWrap, { borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.input }]}
              value={checkInLookup}
            />
            <View style={styles.lookupActionRow}>
              <EventSlotOutlineButton label={checkInLoading ? "Checking..." : "Verify ticket"} theme={theme} disabled={checkInLoading} onPress={handleManualCheckIn} style={styles.inlineActionButton} />
              <EventSlotOutlineButton label="Preview scan" theme={theme} tone="text" disabled={checkInLoading} onPress={handlePreviewScan} style={styles.inlineActionButton} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCheckInLookup("DEMO-SCAN-001");
                setCheckInResult(null);
              }}
              style={styles.quickLookupButton}
            >
              <Text style={[styles.quickLookupText, { color: theme.colors.accent }]}>Use demo lookup</Text>
            </Pressable>
          </EventSlotInsetCard>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Quick lookup presets</Text>
            <View style={styles.quickLookupRow}>
              {["DEMO-SCAN-001", "USED-TICKET-001", "404-NOT-FOUND"].map((value) => (
                <Pressable
                  accessibilityRole="button"
                  key={value}
                  onPress={() => {
                    setCheckInLookup(value);
                    setCheckInResult(null);
                  }}
                  style={[styles.quickChip, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
                >
                  <Text style={[styles.quickChipText, { color: theme.colors.secondary }]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </EventSlotInsetCard>
          {checkInResult ? (
            <EventSlotInsetCard
              theme={theme}
              style={[
                styles.featureCard,
                checkInResult.status === "verified"
                  ? { borderColor: theme.colors.success }
                  : checkInResult.status === "error" || checkInResult.status === "not-found"
                    ? { borderColor: theme.colors.error }
                    : undefined
              ]}
            >
              <Text
                style={[
                  styles.resultTitle,
                  {
                    color:
                      checkInResult.status === "verified"
                        ? theme.colors.success
                        : checkInResult.status === "error" || checkInResult.status === "not-found"
                          ? theme.colors.error
                          : theme.colors.accent
                  }
                ]}
              >
                {checkInResult.status.replace("-", " ").toUpperCase()}
              </Text>
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{checkInResult.message}</Text>
              {checkInResult.ticket ? (
                <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                  {checkInResult.ticket.attendeeName} | {checkInResult.ticket.ticketCode} | Remaining {checkInResult.ticket.admissionsRemaining}
                </Text>
              ) : null}
            </EventSlotInsetCard>
          ) : null}
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <View style={styles.historyHeader}>
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Recent checks</Text>
              <EventSlotOutlineButton label="Clear" theme={theme} onPress={handleClearCheckInHistory} style={styles.clearButton} />
            </View>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {getVerificationHistoryReadinessMessage()}
            </Text>
            {eventVerificationHistory.length === 0 ? (
              <Text style={[styles.actionValue, { color: theme.colors.muted }]}>No native check-in attempts saved for this event yet.</Text>
            ) : (
              eventVerificationHistory.slice(0, 5).map((entry) => (
                <View key={entry.id} style={[styles.exportHistoryItem, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
                    {entry.status.replace("-", " ").toUpperCase()} - {entry.method.toUpperCase()}
                  </Text>
                  <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                    {entry.ticketCode ?? entry.lookupValue}
                    {entry.attendeeName ? ` | ${entry.attendeeName}` : ""}
                  </Text>
                  <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{formatExportHistoryTime(entry.checkedAt)}</Text>
                </View>
              ))
            )}
          </EventSlotInsetCard>
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "email" ? (
        <EventSlotSectionCard title="Email Campaigns" caption="Mirror the organizer email tools from the web event workspace." theme={theme}>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Compose campaign</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              Subject, message body, and recipient filters for all attendees, confirmed only, or waitlist only belong here.
            </Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {getNativeEmailCampaignReadinessMessage()}
            </Text>
            <View style={styles.quickLookupRow}>
              {nativeEmailTemplates.map((template) => (
                <Pressable
                  accessibilityRole="button"
                  key={template.id}
                  onPress={() => handleApplyEmailTemplate(template.id)}
                  style={[styles.quickChip, { borderColor: theme.colors.border, backgroundColor: theme.colors.input }]}
                >
                  <Text style={[styles.quickChipText, { color: theme.colors.secondary }]}>{template.label}</Text>
                </Pressable>
              ))}
            </View>
            <EventSlotField
              label="Subject"
              value={campaignSubject}
              onChangeText={(value) => {
                setCampaignSubject(value);
                setCampaignStatus("Campaign draft updated.");
              }}
              placeholder="Important event update"
              theme={theme}
            />
            <EventSlotField
              label="Message"
              value={campaignMessage}
              onChangeText={(value) => {
                setCampaignMessage(value);
                setCampaignStatus("Campaign draft updated.");
              }}
              placeholder="Write your attendee update here"
              theme={theme}
              multiline
            />
            <View style={styles.quickLookupRow}>
              {([
                { key: "all", label: "All" },
                { key: "confirmed", label: "Confirmed" },
                { key: "waitlist", label: "Waitlist" }
              ] as const).map((option) => {
                const active = campaignRecipientFilter === option.key;

                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.key}
                    onPress={() => {
                      setCampaignRecipientFilter(option.key);
                      setCampaignStatus(`Audience set to ${option.label.toLowerCase()}.`);
                    }}
                    style={[
                      styles.quickChip,
                      {
                        borderColor: active ? theme.colors.accent : theme.colors.border,
                        backgroundColor: active ? theme.colors.activeTab : theme.colors.input
                      }
                    ]}
                  >
                    <Text style={[styles.quickChipText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                      {option.label} ({option.key === "all" ? registrationWorkspace.confirmed.length + registrationWorkspace.waitlist.length : option.key === "confirmed" ? registrationWorkspace.confirmed.length : registrationWorkspace.waitlist.length})
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {campaignStatus}
            </Text>
            <View style={styles.lookupActionRow}>
              <EventSlotOutlineButton label="Save send preview" theme={theme} onPress={handleSendCampaign} style={styles.inlineActionButton} />
              <EventSlotOutlineButton
                label="Open attendees"
                theme={theme}
                tone="text"
                onPress={() => setActiveTab(campaignRecipientFilter === "waitlist" ? "waitlist" : "confirmed")}
                style={styles.inlineActionButton}
              />
            </View>
          </EventSlotInsetCard>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Send history</Text>
            <View style={styles.historyHeader}>
              <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                Recent local campaign previews for this event.
              </Text>
              <EventSlotOutlineButton label="Clear" theme={theme} onPress={handleClearCampaignHistory} style={styles.clearButton} />
            </View>
            {campaignHistory.length === 0 ? (
              <Text style={[styles.actionValue, { color: theme.colors.muted }]}>
                No campaign history saved for this event on this device yet.
              </Text>
            ) : (
              campaignHistory.slice(0, 5).map((entry) => (
                <View key={entry.id} style={[styles.exportHistoryItem, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{entry.subject}</Text>
                  <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                    {entry.recipientFilter.toUpperCase()} | {entry.recipientCount} recipient{entry.recipientCount === 1 ? "" : "s"}
                    {entry.templateLabel ? ` | ${entry.templateLabel}` : ""}
                  </Text>
                  <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{formatExportHistoryTime(entry.sentAt)}</Text>
                </View>
              ))
            )}
          </EventSlotInsetCard>
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "analytics" ? (
        <EventSlotSectionCard title="Analytics" caption="Match the web event analytics dashboard with mobile-friendly cards and charts." theme={theme}>
          <EventSlotSegmentedOptions
            label="Date range"
            options={[
              { label: "7D", value: "7d" },
              { label: "30D", value: "30d" },
              { label: "All", value: "all" }
            ]}
            selected={analyticsRange}
            onSelect={setAnalyticsRange}
            theme={theme}
          />
          <EventSlotMetricGrid>
            <MetricCard label="Attendance rate" value={`${analytics.attendanceRate}%`} trend="Confirmed vs capacity" theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
            <MetricCard label="Waitlist conversion" value={`${analytics.waitlistConversionRate}%`} trend={`${event.waitlist} still waiting`} theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
            <MetricCard label="Average registrations" value={`${analytics.averageRegistrationsPerBucket}`} trend={`${analyticsRange.toUpperCase()} window`} theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
            <MetricCard label="Revenue view" value={analytics.grossRevenueLabel} trend={paidEvent ? "Gross estimate from current event data" : "Free event"} theme={theme} valueWeight="400" valueSize={28} trendSize={12} />
          </EventSlotMetricGrid>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Registrations over time</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              Current fill rate: {analytics.fillRate}% of capacity.
            </Text>
            <View style={styles.analyticsSeries}>
              {analytics.registrationsSeries.map((point) => (
                <View key={`${point.label}-${point.value}`} style={styles.analyticsBarItem}>
                  <View style={[styles.analyticsBarTrack, { backgroundColor: theme.colors.input }]}>
                    <View
                      style={[
                        styles.analyticsBarFill,
                        {
                          backgroundColor: theme.colors.accent,
                          height: `${Math.max(12, analytics.registrationsSeries.length ? (point.value / Math.max(...analytics.registrationsSeries.map((item) => item.value), 1)) * 100 : 0)}%`
                        }
                      ]}
                    />
                  </View>
                  <Text style={[styles.analyticsBarValue, { color: theme.colors.text }]}>{point.value}</Text>
                  <Text style={[styles.analyticsBarLabel, { color: theme.colors.secondary }]}>{point.label}</Text>
                </View>
              ))}
            </View>
          </EventSlotInsetCard>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Source breakdown</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              Strongest source: {analytics.strongestSource ?? "No source data yet"}.
            </Text>
            {analytics.sourceBreakdown.length === 0 ? (
              <Text style={[styles.actionValue, { color: theme.colors.muted }]}>No source breakdown is available for the selected range yet.</Text>
            ) : (
              analytics.sourceBreakdown.slice(0, 4).map((source) => {
                const total = Math.max(analytics.sourceBreakdown.reduce((sum, item) => sum + item.count, 0), 1);
                const width = `${Math.max(8, Math.round((source.count / total) * 100))}%` as const;

                return (
                  <View key={source.label} style={styles.sourceRow}>
                    <View style={styles.sourceCopy}>
                      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{source.label}</Text>
                      <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{source.count} registration{source.count === 1 ? "" : "s"}</Text>
                    </View>
                    <View style={[styles.sourceTrack, { backgroundColor: theme.colors.input }]}>
                      <View style={[styles.sourceFill, { backgroundColor: theme.colors.accent, width }]} />
                    </View>
                  </View>
                );
              })
            )}
          </EventSlotInsetCard>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Capacity and conversion guidance</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {analytics.fillRate >= 90
                ? "This event is nearly full. Consider opening overflow capacity or monitoring waitlist promotions closely."
                : analytics.fillRate >= 60
                  ? "This event is filling well. Keep promotion focused on your strongest source and attendee reminders."
                  : "There is still room to grow. Use reminders, social sharing, and direct outreach to increase registrations."}
            </Text>
          </EventSlotInsetCard>
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "insights" ? (
        <EventSlotSectionCard title="AI Insights" caption="Reserve the quota-aware AI insights flow from the brief." theme={theme}>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Generate insight</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {getNativeInsightReadinessMessage()}
            </Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              Usage preview: {insightQuota.used} of {insightQuota.limit === 999 ? "Unlimited" : insightQuota.limit} insights used this month.
            </Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{insightStatus}</Text>
            <View style={styles.lookupActionRow}>
              <EventSlotOutlineButton label="Generate insights" theme={theme} onPress={handleGenerateInsights} style={styles.inlineActionButton} />
              <EventSlotOutlineButton label="Prepare AI report" theme={theme} tone="text" onPress={() => setActiveTab("exports")} style={styles.inlineActionButton} />
            </View>
          </EventSlotInsetCard>
          {insightCards.length > 0 ? (
            insightCards.map((card) => (
              <EventSlotInsetCard
                key={card.id}
                theme={theme}
                style={[
                  styles.featureCard,
                  card.tone === "warning"
                    ? { borderColor: theme.colors.error }
                    : card.tone === "success"
                      ? { borderColor: theme.colors.success }
                      : card.tone === "action"
                        ? { borderColor: theme.colors.accent }
                        : undefined
                ]}
              >
                <Text
                  style={[
                    styles.resultTitle,
                    {
                      color:
                        card.tone === "warning"
                          ? theme.colors.error
                          : card.tone === "success"
                            ? theme.colors.success
                            : theme.colors.accent
                    }
                  ]}
                >
                  {card.tone.toUpperCase()}
                </Text>
                <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{card.title}</Text>
                <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{card.body}</Text>
              </EventSlotInsetCard>
            ))
          ) : (
            <EventSlotMessageCard
              title="No insights generated yet"
              caption="Generate insights to create quota-aware event guidance from the current analytics snapshot."
              theme={theme}
              tone="input"
            />
          )}
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <View style={styles.historyHeader}>
              <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Insight history</Text>
              <EventSlotOutlineButton label="Clear" theme={theme} onPress={handleClearInsights} style={styles.clearButton} />
            </View>
            {insightHistory.length === 0 ? (
              <Text style={[styles.actionValue, { color: theme.colors.muted }]}>No local insight history saved for this event yet.</Text>
            ) : (
              insightHistory.slice(0, 4).map((entry) => (
                <View key={entry.id} style={[styles.exportHistoryItem, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>
                    {entry.cards.length} card{entry.cards.length === 1 ? "" : "s"} generated
                  </Text>
                  <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                    Usage {entry.quotaUsed} / {entry.quotaLimit === 999 ? "Unlimited" : entry.quotaLimit}
                  </Text>
                  <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{formatExportHistoryTime(entry.generatedAt)}</Text>
                </View>
              ))
            )}
          </EventSlotInsetCard>
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "settings" ? (
        <EventSlotSectionCard title="Settings" caption="Keep event controls grouped here as the routed workspace fills out." theme={theme}>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{getNativeEventManagementReadinessMessage()}</Text>
          {settingsDraft ? (
            <>
              <EventSlotField
                label="Event title"
                value={settingsDraft.title}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, title: value });
                  setSettingsStatus("Event title updated locally.");
                }}
                placeholder="Rename this event"
                theme={theme}
              />
              <EventSlotSegmentedOptions
                label="Event mode"
                options={[
                  { label: "Physical", value: "physical" },
                  { label: "Virtual", value: "virtual" }
                ]}
                selected={settingsDraft.eventType}
                onSelect={(value) => {
                  setSettingsDraft({ ...settingsDraft, eventType: value });
                  setSettingsStatus("Event mode updated locally.");
                }}
                theme={theme}
              />
              <EventSlotField
                label="Description"
                value={settingsDraft.description}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, description: value });
                  setSettingsStatus("Event description updated locally.");
                }}
                placeholder="Tell attendees what to expect."
                theme={theme}
                multiline
              />
              <EventSlotField
                label="Capacity"
                value={settingsDraft.capacity}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, capacity: value.replace(/[^0-9]/g, "") });
                  setSettingsStatus("Capacity draft updated locally.");
                }}
                placeholder="120"
                theme={theme}
                keyboardType="number-pad"
                helperText="Use this to increase or reduce capacity. Paid events still use ticket-tier capacity on web."
              />
              <View style={styles.lookupActionRow}>
                <EventSlotOutlineButton label="Save capacity" theme={theme} onPress={handleSaveCapacity} style={styles.inlineActionButton} />
              </View>
              {event.paymentMode !== "Registration only" ? (
                <EventSlotInsetCard theme={theme} style={styles.featureCard}>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Paid ticket tiers</Text>
                  <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                    Adjust paid-tier names, prices, and capacities here. Tier capacity remains the source of truth for paid events.
                  </Text>
                  {settingsDraft.ticketTiers.map((tier, index) => (
                    <EventSlotInsetCard key={tier.id} theme={theme} style={styles.ticketTierCard}>
                      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Tier {index + 1}</Text>
                      <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>Preset tier</Text>
                      <View style={styles.tierPresetWrap}>
                        {TIER_PRESETS.map((preset) => {
                          const active = tier.presetKey === preset.key;

                          return (
                            <Pressable
                              accessibilityRole="button"
                              key={`${tier.id}-${preset.key}`}
                              onPress={() => handleTierPresetChange(tier.id, preset.key)}
                              style={[
                                styles.quickChip,
                                {
                                  borderColor: active ? theme.colors.accent : theme.colors.border,
                                  backgroundColor: active ? theme.colors.activeTab : theme.colors.input
                                }
                              ]}
                            >
                              <Text style={[styles.quickChipText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>
                                {preset.defaultName}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View
                        style={[
                          styles.tierPreviewBadge,
                          {
                            backgroundColor: tier.badgeColor ?? theme.colors.input,
                            borderColor: tier.badgeColor ?? theme.colors.border
                          }
                        ]}
                      >
                        <Text style={[styles.tierPreviewText, { color: tier.textColor ?? theme.colors.text }]}>
                          {tier.name || "Tier preview"}
                        </Text>
                      </View>
                      <EventSlotField
                        label="Tier name"
                        value={tier.name}
                        onChangeText={(value) => handleTierDraftChange(tier.id, "name", value)}
                        placeholder="VIP"
                        theme={theme}
                      />
                      <EventSlotField
                        label="Price (KES)"
                        value={tier.price}
                        onChangeText={(value) => handleTierDraftChange(tier.id, "price", value)}
                        placeholder="1500"
                        theme={theme}
                        keyboardType="number-pad"
                      />
                      <EventSlotField
                        label="Capacity"
                        value={tier.capacity}
                        onChangeText={(value) => handleTierDraftChange(tier.id, "capacity", value)}
                        placeholder="50"
                        theme={theme}
                        keyboardType="number-pad"
                        helperText={
                          tier.soldCount || tier.waitlistCount
                            ? `Sold ${tier.soldCount ?? 0} | Waitlist ${tier.waitlistCount ?? 0}`
                            : undefined
                        }
                      />
                      <EventSlotField
                        label="Bundle size"
                        value={tier.bundleSize ?? ""}
                        onChangeText={(value) => handleTierDraftChange(tier.id, "bundleSize", value)}
                        placeholder="1"
                        theme={theme}
                        keyboardType="number-pad"
                        helperText="How many entries this ticket grants."
                      />
                      <EventSlotField
                        label="Tier description"
                        value={tier.description ?? ""}
                        onChangeText={(value) => handleTierDraftChange(tier.id, "description", value)}
                        placeholder="Optional tier description"
                        theme={theme}
                        multiline
                      />
                      <EventSlotOutlineButton
                        label={settingsDraft.ticketTiers.length === 1 ? "Reset tier later" : "Remove tier"}
                        theme={theme}
                        tone="text"
                        onPress={() => handleRemoveTicketTierDraft(tier.id)}
                        style={styles.inlineActionButton}
                      />
                    </EventSlotInsetCard>
                  ))}
                  <View style={styles.lookupActionRow}>
                    <EventSlotOutlineButton label="Add ticket tier" theme={theme} onPress={handleAddTicketTierDraft} style={styles.inlineActionButton} />
                    <EventSlotOutlineButton label="Save paid tiers" theme={theme} onPress={handleSaveTicketTiers} style={styles.inlineActionButton} />
                  </View>
                </EventSlotInsetCard>
              ) : null}
              <EventSlotField
                label="Venue"
                value={settingsDraft.location}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, location: value });
                  setSettingsStatus("Venue updated locally.");
                }}
                placeholder="Nairobi Garage"
                theme={theme}
              />
              <EventSlotField
                label="Map link"
                value={settingsDraft.mapDirectionsUrl}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, mapDirectionsUrl: value });
                  setSettingsStatus("Map link updated locally.");
                }}
                placeholder="https://maps.google.com/..."
                theme={theme}
              />
              <EventSlotField
                label="Entry fee note"
                value={settingsDraft.entryFeeLabel}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, entryFeeLabel: value });
                  setSettingsStatus("Entry fee note updated locally.");
                }}
                placeholder="Free entry or KES 1,500 at the gate"
                theme={theme}
              />
              <DateTimeDraftField
                label="Registration deadline"
                value={settingsDraft.deadline}
                fallbackDate={extractIsoDatePart(settingsDraft.eventDate) || DEFAULT_SETTINGS_DATE}
                defaultTime="18:00"
                emptyLabel="No registration deadline set yet."
                onChangeValue={(value) => {
                  setSettingsDraft({ ...settingsDraft, deadline: value });
                  setSettingsStatus("Registration deadline updated locally.");
                }}
                theme={theme}
              />
              <DateTimeDraftField
                label="Event start"
                value={settingsDraft.eventDate}
                fallbackDate={DEFAULT_SETTINGS_DATE}
                defaultTime="09:00"
                emptyLabel="No event start time set yet."
                onChangeValue={(value) => {
                  setSettingsDraft({ ...settingsDraft, eventDate: value });
                  setSettingsStatus("Event start time updated locally.");
                }}
                theme={theme}
              />
              <DateTimeDraftField
                label="Event end"
                value={settingsDraft.eventEndAt}
                fallbackDate={extractIsoDatePart(settingsDraft.eventDate) || DEFAULT_SETTINGS_DATE}
                defaultTime="17:00"
                emptyLabel="No event end time set yet."
                onChangeValue={(value) => {
                  setSettingsDraft({ ...settingsDraft, eventEndAt: value });
                  setSettingsStatus("Event end time updated locally.");
                }}
                theme={theme}
              />
              <DateTimeDraftField
                label="Join opens"
                value={settingsDraft.joinOpensAt}
                fallbackDate={extractIsoDatePart(settingsDraft.eventDate) || DEFAULT_SETTINGS_DATE}
                defaultTime="08:30"
                emptyLabel="No join-open time set yet."
                onChangeValue={(value) => {
                  setSettingsDraft({ ...settingsDraft, joinOpensAt: value });
                  setSettingsStatus("Join-open time updated locally.");
                }}
                theme={theme}
              />
              <EventSlotSegmentedOptions
                label="Feedback form"
                options={[
                  { label: "Off", value: "off" },
                  { label: "On", value: "on" }
                ]}
                selected={settingsDraft.feedbackEnabled ? "on" : "off"}
                onSelect={(value) => {
                  setSettingsDraft({ ...settingsDraft, feedbackEnabled: value === "on" });
                  setSettingsStatus("Feedback form preference updated locally.");
                }}
                theme={theme}
              />
              <EventSlotSegmentedOptions
                label="Attendee consent"
                options={[
                  { label: "Off", value: "off" },
                  { label: "On", value: "on" }
                ]}
                selected={settingsDraft.attendeeConsentEnabled ? "on" : "off"}
                onSelect={(value) => {
                  setSettingsDraft({ ...settingsDraft, attendeeConsentEnabled: value === "on" });
                  setSettingsStatus(value === "on" ? "Attendee consent enabled in this mobile settings draft." : "Attendee consent disabled in this mobile settings draft.");
                }}
                theme={theme}
              />
              <EventSlotSegmentedOptions
                label="Remaining spots on attendee page"
                options={[
                  { label: "Visible", value: "visible" },
                  { label: "Hidden", value: "hidden" }
                ]}
                selected={settingsDraft.showRemainingSpots ? "visible" : "hidden"}
                onSelect={(value) => {
                  setSettingsDraft({ ...settingsDraft, showRemainingSpots: value === "visible" });
                  setSettingsStatus(
                    value === "visible"
                      ? "Attendees will see remaining spots in this mobile settings draft."
                      : "Remaining spots are hidden from attendees in this mobile settings draft."
                  );
                }}
                theme={theme}
              />
              {settingsDraft.attendeeConsentEnabled ? (
                <EventSlotField
                  label="Consent wording"
                  value={settingsDraft.attendeeConsentText}
                  onChangeText={(value) => {
                    setSettingsDraft({ ...settingsDraft, attendeeConsentText: value });
                    setSettingsStatus("Consent wording updated locally.");
                  }}
                  placeholder="I consent to EventSlot processing my data in line with the Kenya Data Protection Act 2019."
                  theme={theme}
                  multiline
                />
              ) : null}
              <EventSlotField
                label="Community link"
                value={settingsDraft.communityLink}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, communityLink: value });
                  setSettingsStatus("Community link updated locally.");
                }}
                placeholder="https://chat.whatsapp.com/..."
                theme={theme}
              />
              <EventSlotField
                label="Organizer contact"
                value={settingsDraft.whatsappNumber}
                onChangeText={(value) => {
                  setSettingsDraft({ ...settingsDraft, whatsappNumber: value });
                  setSettingsStatus("Organizer contact updated locally.");
                }}
                placeholder="+254700000000"
                theme={theme}
                keyboardType="phone-pad"
              />
              <EventSlotSegmentedOptions
                label="Contact action"
                options={[
                  { label: "Chat", value: "WHATSAPP" },
                  { label: "Call", value: "CALL" }
                ]}
                selected={settingsDraft.contactMode}
                onSelect={(value) => {
                  setSettingsDraft({ ...settingsDraft, contactMode: value });
                  setSettingsStatus(value === "CALL" ? "Organizer contact action set to call." : "Organizer contact action set to chat.");
                }}
                theme={theme}
              />
              <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{settingsStatus}</Text>
              <View style={styles.lookupActionRow}>
                <EventSlotOutlineButton label="Save settings" theme={theme} onPress={handleSaveSettingsDraft} style={styles.inlineActionButton} />
                <EventSlotOutlineButton label="Duplicate event" theme={theme} tone="text" onPress={handleMarkDuplicate} style={styles.inlineActionButton} />
              </View>
              <View style={styles.lookupActionRow}>
                <EventSlotOutlineButton
                  label={settingsDraft.archived ? "Unarchive" : "Archive"}
                  theme={theme}
                  onPress={handleArchiveToggle}
                  style={styles.inlineActionButton}
                />
                <EventSlotOutlineButton
                  label={settingsDraft.deleted ? "Undo delete" : "Delete"}
                  theme={theme}
                  tone="text"
                  onPress={handleDeleteToggle}
                  style={styles.inlineActionButton}
                />
              </View>
            </>
          ) : null}
        </EventSlotSectionCard>
      ) : null}

      {activeTab === "team" ? (
        <EventSlotSectionCard title="Team" caption="Mirror the member and invite controls from the web event workspace." theme={theme}>
          <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{accessSummary.caption}</Text>
          <View style={styles.capabilityRow}>
            {accessSummary.capabilities.map((capability) => (
              <EventSlotPill key={`team-${capability}`} label={formatCapabilityLabel(capability)} theme={theme} style={styles.capabilityPill} />
            ))}
          </View>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Invite by email</Text>
            <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
              {teamStatus}
            </Text>
            <EventSlotField
              label="Invite email"
              value={teamInviteEmail}
              onChangeText={setTeamInviteEmail}
              placeholder="teammate@example.com"
              theme={theme}
            />
            <EventSlotSegmentedOptions
              label="Role"
              options={[
                { label: "Viewer", value: "Viewer" },
                { label: "Editor", value: "Editor" }
              ]}
              selected={teamInviteRole}
              onSelect={setTeamInviteRole}
              theme={theme}
            />
            <EventSlotOutlineButton label="Add team invite" theme={theme} onPress={handleInviteTeamMember} style={styles.inlineActionButton} />
          </EventSlotInsetCard>
          <EventSlotInsetCard theme={theme} style={styles.featureCard}>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>Team members</Text>
            {teamMembers.length === 0 ? (
              <Text style={[styles.actionValue, { color: theme.colors.muted }]}>No event team members saved locally yet.</Text>
            ) : (
              teamMembers.map((member) => (
                <View key={member.id} style={[styles.exportHistoryItem, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{member.email}</Text>
                  <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>
                    {member.role} | {member.status}
                  </Text>
                  <View style={styles.lookupActionRow}>
                    <EventSlotOutlineButton label={member.role === "Editor" ? "Make viewer" : "Make editor"} theme={theme} onPress={() => handleToggleTeamRole(member.id)} style={styles.inlineActionButton} />
                    <EventSlotOutlineButton label="Remove" theme={theme} tone="text" onPress={() => handleRemoveTeamMember(member.id)} style={styles.inlineActionButton} />
                  </View>
                </View>
              ))
            )}
          </EventSlotInsetCard>
        </EventSlotSectionCard>
      ) : null}
    </View>
  );
}

type CheckInModeButtonProps = {
  label: string;
  mode: NativeScanMode;
  activeMode: NativeScanMode;
  onPress: () => void;
  theme: EventDetailScreenProps["theme"];
};

const DEFAULT_SETTINGS_DATE = "2026-07-28";
const DEFAULT_SETTINGS_OFFSET = "+03:00";

function CheckInModeButton({ label, mode, activeMode, onPress, theme }: CheckInModeButtonProps) {
  const active = mode === activeMode;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.modeButton,
        {
          backgroundColor: active ? theme.colors.activeTab : theme.colors.input,
          borderColor: active ? theme.colors.accent : theme.colors.border
        }
      ]}
    >
      <Text style={[styles.modeButtonText, { color: active ? theme.colors.accent : theme.colors.secondary }]}>{label}</Text>
    </Pressable>
  );
}

function buildEventRegistrationUrl(slug: string) {
  return `${nativeConfig.apiBaseUrl}/events/${slug}`;
}

type DateTimeDraftFieldProps = {
  label: string;
  value: string;
  fallbackDate: string;
  defaultTime: string;
  emptyLabel: string;
  onChangeValue: (value: string) => void;
  theme: EventDetailScreenProps["theme"];
};

function DateTimeDraftField({
  label,
  value,
  fallbackDate,
  defaultTime,
  emptyLabel,
  onChangeValue,
  theme
}: DateTimeDraftFieldProps) {
  const datePart = extractIsoDatePart(value);
  const timePart = extractIsoTimePart(value);
  const helperText = buildDateTimeHelperText(value, emptyLabel);

  return (
    <View style={styles.dateTimeFieldBlock}>
      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{helperText}</Text>
      <View style={styles.dateTimeFieldGrid}>
        <EventSlotField
          label={`${label} date`}
          value={datePart}
          onChangeText={(nextDate) =>
            onChangeValue(
              composeIsoDateTimeDraftValue({
                currentValue: value,
                datePart: nextDate,
                timePart,
                fallbackDate,
                defaultTime
              })
            )
          }
          placeholder="2026-08-15"
          theme={theme}
          helperText="Use YYYY-MM-DD"
        />
        <EventSlotField
          label={`${label} time`}
          value={timePart}
          onChangeText={(nextTime) =>
            onChangeValue(
              composeIsoDateTimeDraftValue({
                currentValue: value,
                datePart,
                timePart: nextTime,
                fallbackDate,
                defaultTime
              })
            )
          }
          placeholder="09:00"
          theme={theme}
          helperText="Use 24-hour HH:MM"
        />
      </View>
    </View>
  );
}

function formatExportHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function extractIsoDatePart(value: string): string {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})T/);
  return match?.[1] ?? "";
}

function extractIsoTimePart(value: string): string {
  const match = value.trim().match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? "";
}

function extractIsoOffsetPart(value: string): string {
  const match = value.trim().match(/([+-]\d{2}:\d{2}|Z)$/);
  return match?.[1] ?? DEFAULT_SETTINGS_OFFSET;
}

function composeIsoDateTimeDraftValue(input: {
  currentValue: string;
  datePart: string;
  timePart: string;
  fallbackDate: string;
  defaultTime: string;
}) {
  const normalizedDate = input.datePart.trim();
  const normalizedTime = input.timePart.trim();

  if (!normalizedDate && !normalizedTime) {
    return "";
  }

  const nextDate = normalizedDate || extractIsoDatePart(input.currentValue) || input.fallbackDate;
  const nextTime = normalizedTime || extractIsoTimePart(input.currentValue) || input.defaultTime;
  const offset = extractIsoOffsetPart(input.currentValue);

  return `${nextDate}T${nextTime}:00${offset === "Z" ? "Z" : offset}`;
}

function buildDateTimeHelperText(value: string, emptyLabel: string): string {
  if (!value.trim()) {
    return `${emptyLabel} The saved timezone stays +03:00.`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `Current value: ${value}. Update the date and time fields to restore a valid EventSlot timestamp.`;
  }

  return `${parsed.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric"
  })} | Stored as ${value}`;
}

type ActionLineProps = {
  label: string;
  value: string;
  action?: string;
  onPress?: () => void;
  theme: EventDetailScreenProps["theme"];
};

function ActionLine({ label, value, action, onPress, theme }: ActionLineProps) {
  return (
    <EventSlotInfoRow
      title={label}
      subtitle={value}
      theme={theme}
      rightSlot={action ? <EventSlotOutlineButton label={action} theme={theme} onPress={onPress} style={styles.inlineButton} /> : undefined}
    />
  );
}

type ExportActionCardProps = {
  action: NativeExportAction;
  onPrepare: () => void;
  theme: EventDetailScreenProps["theme"];
};

function ExportActionCard({ action, onPrepare, theme }: ExportActionCardProps) {
  const ready = action.state === "ready";

  return (
    <EventSlotInsetCard theme={theme} style={[styles.exportCard, ready ? { borderColor: theme.colors.accent } : undefined]}>
      <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{action.title}</Text>
      <Text style={[styles.actionValue, { color: theme.colors.secondary }]}>{action.caption}</Text>
      <Text style={[styles.exportEndpoint, { color: theme.colors.muted }]}>{action.endpoint}</Text>
      <EventSlotPill label={ready ? "READY" : "LIVE API"} theme={theme} tone={ready ? "accent" : "muted"} size="xs" style={styles.registrationStatus} />
      <EventSlotOutlineButton label="Prepare export" theme={theme} onPress={onPrepare} style={styles.shareButton} />
    </EventSlotInsetCard>
  );
}

type RegistrationLineProps = {
  registration: ReturnType<typeof buildDemoRegistrationWorkspace>["confirmed"][number];
  theme: EventDetailScreenProps["theme"];
  onPress?: () => void;
  actionLabel?: string;
  onActionPress?: () => void;
};

function RegistrationLine({ registration, theme, onPress, actionLabel, onActionPress }: RegistrationLineProps) {
  const meta = [
    registration.attendeePhone,
    registration.attendeeEmail,
    registration.waitlistPosition ? `#${registration.waitlistPosition} waitlist` : undefined,
    registration.submittedAtLabel,
    registration.tierLabel
  ].filter(Boolean);

  return (
    <View>
      <Pressable accessibilityRole="button" onPress={onPress}>
        <EventSlotInfoRow
          title={registration.attendeeName}
          subtitle={meta.join(" | ")}
          theme={theme}
          rightSlot={
            <EventSlotPill
              label={registration.status.toUpperCase()}
              theme={theme}
              tone={registration.status === "confirmed" ? "success" : "accent"}
              size="xs"
              style={styles.registrationStatus}
            />
          }
        />
      </Pressable>
      {actionLabel && onActionPress ? (
        <View style={styles.registrationActionRow}>
          <EventSlotOutlineButton label={actionLabel} theme={theme} onPress={onActionPress} style={styles.inlineActionButton} />
        </View>
      ) : null}
    </View>
  );
}

function applyPromotedWaitlist(
  workspace: ReturnType<typeof buildDemoRegistrationWorkspace>,
  promotedIds: string[]
) {
  if (promotedIds.length === 0) {
    return workspace;
  }

  const promotedIdSet = new Set(promotedIds);
  const promotedRegistrations = workspace.waitlist
    .filter((registration) => promotedIdSet.has(registration.id))
    .map((registration) => ({
      ...registration,
      status: "confirmed" as const,
      waitlistPosition: undefined
    }));

  const remainingWaitlist = workspace.waitlist
    .filter((registration) => !promotedIdSet.has(registration.id))
    .map((registration, index) => ({
      ...registration,
      waitlistPosition: index + 1
    }));

  return {
    confirmed: [...workspace.confirmed, ...promotedRegistrations],
    waitlist: remainingWaitlist
  };
}

function filterRegistrationPreviews<
  T extends {
    attendeeName: string;
    attendeeEmail?: string;
    attendeePhone?: string;
    ticketCode?: string;
    confirmationCode?: string;
  }
>(registrations: T[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return registrations;
  }

  return registrations.filter((registration) =>
    [
      registration.attendeeName,
      registration.attendeeEmail,
      registration.attendeePhone,
      registration.ticketCode,
      registration.confirmationCode
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery))
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 14
  },
  backLink: {
    fontSize: 13,
    fontWeight: "700"
  },
  hero: {
    gap: 16,
    padding: 22
  },
  titleRow: {
    gap: 12
  },
  titleCopy: {
    gap: 10
  },
  title: {
    fontSize: 32,
    fontWeight: "400",
    lineHeight: 38
  },
  metaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaPill: {
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  statusBadge: {
    alignSelf: "flex-start"
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  heroLinkStrip: {
    marginTop: 2
  },
  headerActionButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: "700"
  },
  mapButton: {
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 11
  },
  mapButtonText: {
    color: "#0A0A0A",
    fontSize: 13,
    fontWeight: "700"
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "900"
  },
  actionValue: {
    fontSize: 13,
    lineHeight: 19
  },
  inlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  overviewActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12
  },
  modeButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: "900"
  },
  inlineActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  dateTimeFieldBlock: {
    gap: 8
  },
  dateTimeFieldGrid: {
    gap: 10
  },
  lookupInputWrap: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  lookupText: {
    fontSize: 14,
    lineHeight: 20
  },
  lookupActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  quickLookupButton: {
    alignSelf: "flex-start",
    marginTop: 2
  },
  quickLookupText: {
    fontSize: 12,
    fontWeight: "900"
  },
  quickLookupRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "800"
  },
  analyticsSeries: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    height: 160,
    marginTop: 12
  },
  analyticsBarItem: {
    alignItems: "center",
    flex: 1,
    gap: 6
  },
  analyticsBarTrack: {
    borderRadius: 999,
    height: 110,
    justifyContent: "flex-end",
    overflow: "hidden",
    width: "100%"
  },
  analyticsBarFill: {
    borderRadius: 999,
    minHeight: 8,
    width: "100%"
  },
  analyticsBarValue: {
    fontSize: 12,
    fontWeight: "900"
  },
  analyticsBarLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center"
  },
  sourceRow: {
    gap: 8,
    marginTop: 10
  },
  sourceCopy: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  sourceTrack: {
    borderRadius: 999,
    height: 8,
    overflow: "hidden",
    width: "100%"
  },
  sourceFill: {
    borderRadius: 999,
    height: "100%"
  },
  exportGrid: {
    gap: 10,
    marginTop: 12
  },
  exportCard: {
    gap: 7,
    padding: 14
  },
  preparedExportCard: {
    gap: 8,
    marginTop: 12,
    padding: 14
  },
  preparedExportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tierPresetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tierPreviewBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  tierPreviewText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  featureCard: {
    gap: 8,
    marginTop: 12,
    padding: 14
  },
  ticketTierCard: {
    gap: 10,
    padding: 12
  },
  exportHistoryCard: {
    gap: 8,
    marginTop: 12,
    padding: 14
  },
  exportHistoryHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  historyHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  exportHistoryItem: {
    borderTopWidth: 1,
    gap: 4,
    paddingTop: 10
  },
  exportEndpoint: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16
  },
  exportStatus: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 10
  },
  capabilityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10
  },
  capabilityPill: {
    marginTop: 0
  },
  verifierCard: {
    gap: 8,
    marginTop: 12,
    padding: 14
  },
  verifierCode: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 3
  },
  shareButton: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  registrationActionRow: {
    alignItems: "flex-start",
    paddingBottom: 8
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  cameraFrame: {
    borderRadius: 24,
    borderWidth: 2,
    height: 260,
    marginTop: 8,
    overflow: "hidden",
    width: "100%"
  },
  cameraView: {
    flex: 1
  },
  scanGuide: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    bottom: 0,
    left: 0,
    paddingVertical: 10,
    position: "absolute",
    right: 0
  },
  scanGuideText: {
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5
  },
  registrationStatus: {
    marginLeft: 8
  },
  resultTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    paddingTop: 12
  }
});
