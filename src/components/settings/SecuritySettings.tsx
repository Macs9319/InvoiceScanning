"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Key } from "lucide-react";

interface SecuritySettingsProps {
  hasPassword: boolean;
}

export function SecuritySettings({ hasPassword }: SecuritySettingsProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      alert("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      alert("New password must be at least 8 characters");
      return;
    }

    setChanging(true);
    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }

      alert("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      alert(error.message || "Failed to change password");
    } finally {
      setChanging(false);
    }
  };

  const canSubmit =
    currentPassword && newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <div className="space-y-6">
      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            {hasPassword
              ? "Update your account password"
              : "This account uses OAuth authentication. Password cannot be set."}
          </CardDescription>
        </CardHeader>
        {hasPassword && (
          <CardContent className="space-y-4">
            {/* Current Password */}
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                disabled={changing}
              />
            </div>

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                minLength={8}
                disabled={changing}
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={changing}
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords don't match</p>
              )}
            </div>

            {/* Change Button */}
            <Button onClick={handlePasswordChange} disabled={!canSubmit || changing}>
              {changing ? "Changing Password..." : "Change Password"}
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Security Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security Information</CardTitle>
          </div>
          <CardDescription>
            Keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Password Requirements</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Minimum 8 characters</li>
              <li>Use a unique password you don't use elsewhere</li>
              <li>Consider using a password manager</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Security Tips</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Enable OAuth sign-in for additional security</li>
              <li>Keep your email address verified</li>
              <li>Sign out when using shared devices</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
