import { redirect } from "react-router";

/**
 * The design has no separate landing page — "Explore Challenges" is the home.
 * This index route simply forwards there.
 */
export function clientLoader() {
  return redirect("/challenges");
}

export default function Home() {
  return null;
}
