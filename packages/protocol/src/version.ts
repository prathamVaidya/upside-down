/**
 * Bumped on any breaking change to messages or the client view.
 *
 * A mismatched client is told to reload rather than tolerated. This is not
 * optional politeness: deploys change the protocol, and stale phones sitting on
 * a coffee table are the normal case, not the edge case.
 */
export const PROTOCOL_VERSION = 2
