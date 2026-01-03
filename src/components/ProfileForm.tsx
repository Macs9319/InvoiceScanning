"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Mail, Calendar, Shield } from "lucide-react";

interface ProfileFormProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    emailVerified: Date | null;
    createdAt: Date;
    accounts: Array<{
      provider: string;
    }>;
  };
  onUpdateSuccess: (name: string) => void;
}

export function ProfileForm({ user, onUpdateSuccess }: ProfileFormProps) {
  const [name, setName] = useState(user.name || "");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Name is required");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const data = await response.json();
      onUpdateSuccess(data.user.name);
      alert("Profile updated successfully!");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      alert(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = name.trim() !== (user.name || "");

  return (
    <div className="space-y-6">
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={100}
                required
              />
              <p className="text-xs text-muted-foreground">
                This is the name that will be displayed across the application.
              </p>
            </div>

            {/* Save Button */}
            <Button type="submit" disabled={!hasChanges || saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            View your account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email */}
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Email Address</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            {user.emailVerified && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium">Verified</span>
              </div>
            )}
          </div>

          {/* Account Created */}
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Member Since</p>
              <p className="text-sm text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Connected Accounts */}
          {user.accounts.length > 0 && (
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Connected Accounts</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {user.accounts.map((account, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                    >
                      {account.provider.charAt(0).toUpperCase() + account.provider.slice(1)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
