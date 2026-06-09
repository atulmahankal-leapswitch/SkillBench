"use client";

import { CSSProperties, ReactNode } from "react";

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles: Record<string, CSSProperties> = {
    primary: { background: "var(--accent)", color: "#fff", border: "none" },
    ghost: {
      background: "transparent",
      color: "var(--fg)",
      border: "1px solid var(--border)",
    },
    danger: {
      background: "transparent",
      color: "#ff8a8a",
      border: "1px solid #6b2b2b",
    },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: "8px 14px",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontSize: 14,
      }}
    >
      {children}
    </button>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "var(--bg)",
  color: "var(--fg)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
};

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span
        style={{
          display: "block",
          fontSize: 13,
          color: "var(--muted)",
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        padding: 24,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          overflow: "auto",
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 20 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#1d2740",
        color: "var(--accent)",
        borderRadius: 999,
        padding: "2px 9px",
        fontSize: 12,
        marginRight: 5,
      }}
    >
      {children}
    </span>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      style={{
        background: "#3a1d1d",
        border: "1px solid #6b2b2b",
        color: "#ffb4b4",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 13,
      }}
    >
      {message}
    </p>
  );
}

export const td: CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid var(--border)",
  fontSize: 14,
};

export const th: CSSProperties = {
  ...td,
  color: "var(--muted)",
  fontWeight: 600,
  textAlign: "left",
};

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 26 }}>{title}</h1>
      {action}
    </div>
  );
}
