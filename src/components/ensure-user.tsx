"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";

export function EnsureUser() {
  const { isSignedIn, isLoaded } = useAuth();
  const getOrCreateMe = useMutation(api.users.getOrCreateMe);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void getOrCreateMe({});
    }
  }, [isLoaded, isSignedIn, getOrCreateMe]);

  return null;
}
