import { request } from "@/utils/request";

export type HomePopupTheme = "sunrise" | "graphite";
export type HomePopupFrequency =
  | "every_time"
  | "daily_once"
  | "daily_twice"
  | "daily_three_times"
  | "campaign_once";

export interface HomePopupAction {
  text: string;
  path: string;
}

export interface HomePopupSecondaryAction extends HomePopupAction {
  enabled: boolean;
}

export interface HomePopupConfig {
  enabled: boolean;
  campaignVersion: string;
  theme: HomePopupTheme;
  kicker: string;
  title: string;
  subtitle: string;
  heroImageUrl?: string;
  primaryAction: HomePopupAction;
  secondaryAction: HomePopupSecondaryAction;
  frequency: HomePopupFrequency;
  startAt?: string;
  endAt?: string;
}

export async function getHomePopup() {
  return request<{ popup: HomePopupConfig | null }>({
    url: "/public/mini/home-popup",
  });
}
