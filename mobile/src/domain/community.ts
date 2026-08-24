export type NativeCommunityRange = "week" | "month" | "all";

export type NativeCommunityLeaderboardEntry = {
  id: string;
  name: string;
  points: number;
  badge: string;
  highlight?: boolean;
};

export type NativeCommunityBadge = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
};

export type NativeCommunitySnapshot = {
  referralLink: string;
  referralCode: string;
  coinBalance: number;
  currentRank: number;
  currentRange: NativeCommunityRange;
  ranges: Record<NativeCommunityRange, NativeCommunityLeaderboardEntry[]>;
  badges: NativeCommunityBadge[];
};
