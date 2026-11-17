// Mock interviews go live in two steps. Admin's Open / Coming soon switch
// (Module settings) decides what candidates see. Production also needs this
// flag: it stays false until the rollout step (roadmap R1.8), after the quality
// tuning (R1.6) and the safety checks (R1.7). On a developer machine the switch
// alone decides, so the whole flow can be tried locally.

export const AI_INTERVIEWS_WIRED = false;
