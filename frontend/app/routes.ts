import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("challenges", "routes/challenges.tsx"),
  route("challenges/new", "routes/challenge-new.tsx"),
  route("challenges/:challengeId", "routes/challenge.tsx"),
  route("profile", "routes/profile.tsx"),
  route("proofs", "routes/proofs.tsx"),
  route("ledger", "routes/ledger.tsx"),
] satisfies RouteConfig;
