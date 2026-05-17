import React from "react";
import { SUPERVISOR_BRAND_LOGO_PATH } from "../utils/branding";
import { SUPERVISOR_THEME } from "../constants/supervisorTheme";

type BrandSize = "sm" | "md" | "lg";

interface SupervisorBrandProps {
  title?: string;
  subtitle?: string;
  size?: BrandSize;
  centered?: boolean;
  hideText?: boolean;
  titleColor?: string;
  subtitleColor?: string;
}

const sizeMap: Record<
  BrandSize,
  { logo: number; radius: number; title: number; subtitle: number }
> = {
  sm: { logo: 32, radius: 10, title: 15, subtitle: 11 },
  md: { logo: 40, radius: 12, title: 16, subtitle: 12 },
  lg: { logo: 56, radius: 16, title: 22, subtitle: 13 },
};

const SupervisorBrand: React.FC<SupervisorBrandProps> = ({
  title = "禾泽云 · 监理端",
  subtitle,
  size = "md",
  centered = false,
  hideText = false,
  titleColor = SUPERVISOR_THEME.textPrimary,
  subtitleColor = SUPERVISOR_THEME.textSecondary,
}) => {
  const metrics = sizeMap[size];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: centered ? "center" : "flex-start",
        gap: hideText ? 0 : 12,
        textAlign: centered ? "center" : "left",
      }}
    >
      <img
        src={SUPERVISOR_BRAND_LOGO_PATH}
        alt="禾泽云"
        style={{
          width: metrics.logo,
          height: metrics.logo,
          borderRadius: metrics.radius,
          objectFit: "cover",
          boxShadow: SUPERVISOR_THEME.subtleShadow,
          flexShrink: 0,
        }}
      />
      {hideText ? null : (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: titleColor,
              fontSize: metrics.title,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: 0,
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                marginTop: 2,
                color: subtitleColor,
                fontSize: metrics.subtitle,
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SupervisorBrand;
