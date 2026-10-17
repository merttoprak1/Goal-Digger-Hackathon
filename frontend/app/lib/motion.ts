/**
 * One easing curve for every Motion transition in the app, so route changes,
 * chat messages and card entrances all share the same feel.
 *
 * Decorative only — `MotionConfig reducedMotion="user"` in the root turns the
 * transforms off for visitors who ask for less motion.
 */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
