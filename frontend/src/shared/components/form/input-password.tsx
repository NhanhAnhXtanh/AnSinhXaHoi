"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/utils";

type InputPasswordProps = React.ComponentProps<"input">;

export const InputPassword = ({ className, ...props }: InputPasswordProps) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className={cn("relative")}>
      <Input
        type={showPassword ? "text" : "password"}
        className={cn(className)}
        {...props}
      />
      <button
        type="button"
        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className={cn(
          "appearance-none rounded-sm",
          "absolute right-2 top-1/2 -translate-y-1/2",
          "text-muted-foreground transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
};

InputPassword.displayName = "InputPassword";
