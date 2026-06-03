import React, { useState } from "react";
import { useSecurityEye } from "@/hooks/use-security-eye";
import { cn } from "@/lib/utils";

interface SecretNumberProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export function SecretNumber({ children, className, ...props }: SecretNumberProps) {
  const { isVisible } = useSecurityEye();
  const [isHovered, setIsHovered] = useState(false);

  // If eye is open, or currently hovered, show normally. Otherwise blur.
  const isBlurred = !isVisible && !isHovered;

  return (
    <span
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "transition-all duration-300 select-all inline-block",
        isBlurred ? "blur-[6px] cursor-pointer bg-muted/40 px-2 rounded select-none" : "",
        className
      )}
      title={isBlurred ? "Hover to reveal" : undefined}
      {...props}
    >
      {children}
    </span>
  );
}
