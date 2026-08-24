import { Href } from "expo-router";

import { AppRoute } from "../tabs";

export function appRouteToHref(route: AppRoute): Href {
  switch (route.name) {
    case "home":
      return "/(tabs)";
    case "events":
      return "/(tabs)/events";
    case "alerts":
      return "/(tabs)/notifications";
    case "more":
    case "profile":
      return "/(tabs)/profile";
    case "billing":
      return "/billing";
    case "payg":
      return "/billing/payg";
    case "verify":
      return "/verify";
    case "team":
      return "/team";
    case "states":
      return "/states";
    case "createEvent":
      return "/events/new";
    case "eventDetail":
      return {
        pathname: "/events/[eventSlug]",
        params: { eventSlug: route.eventId }
      };
    case "eventWorkspace":
      switch (route.tab) {
        case "overview":
          return {
            pathname: "/events/[eventSlug]",
            params: { eventSlug: route.eventSlug }
          };
        case "confirmed":
          return {
            pathname: "/events/[eventSlug]/confirmed",
            params: { eventSlug: route.eventSlug }
          };
        case "waitlist":
          return {
            pathname: "/events/[eventSlug]/waitlist",
            params: { eventSlug: route.eventSlug }
          };
        case "checkin":
          return {
            pathname: "/events/[eventSlug]/checkin",
            params: { eventSlug: route.eventSlug }
          };
        case "email":
          return {
            pathname: "/events/[eventSlug]/email",
            params: { eventSlug: route.eventSlug }
          };
        case "analytics":
          return {
            pathname: "/events/[eventSlug]/analytics",
            params: { eventSlug: route.eventSlug }
          };
        case "insights":
          return {
            pathname: "/events/[eventSlug]/insights",
            params: { eventSlug: route.eventSlug }
          };
        case "settings":
          return {
            pathname: "/events/[eventSlug]/settings",
            params: { eventSlug: route.eventSlug }
          };
        case "team":
          return {
            pathname: "/events/[eventSlug]/team",
            params: { eventSlug: route.eventSlug }
          };
        case "exports":
        default:
          return {
            pathname: "/events/[eventSlug]",
            params: { eventSlug: route.eventSlug }
          };
      }
    case "registrationDetail":
      return {
        pathname: "/events/[eventSlug]/registrations/[registrationId]",
        params: { eventSlug: route.eventSlug, registrationId: route.registrationId }
      };
    default:
      return "/(tabs)";
  }
}
