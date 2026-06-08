import type { HTMLAttributes } from "react";

import { joinClassNames } from "../lib/classNames";

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "outline" | "secondary" }) {
  return (
    <span
      className={joinClassNames(
        "badge",
        variant !== "default" ? `badge--${variant}` : "",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClassNames("card-header", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={joinClassNames("card-title", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={joinClassNames("card-description", className)} {...props} />;
}

export function CodeBlock({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function CodeBlockContent({ className, ...props }: HTMLAttributes<HTMLPreElement>) {
  return <pre className={className} {...props} />;
}

export function CodeBlockCode({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <code className={className} {...props} />;
}

export function Stat({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function StatValue({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function StatDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}
