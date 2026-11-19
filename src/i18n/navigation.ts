import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers; `usePathname` returns the visible path, without the hidden locale segment.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
