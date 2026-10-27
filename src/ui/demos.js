// "Show me": a short demo the neighbor plays on a separate example, never on the child's own draft.
//
//   demoFor(activity, grade) → null | { snapshot, intro?, steps: [{ action, line }], done }
//
//   activity  the resolved Activity (registry.js activityFor), so a demo can key on activity.kind and
//             activity.title, and tests can run the demo through activity.start / activity.act.
//   snapshot  a creation snapshot for the example: activity.start(snapshot, { chapter, grade }) sets it up.
//   intro     what the neighbor says before the first step (optional).
//   steps     applied in order with activity.act(state, ui, action, grade); `line` is said with that step.
//             An action is { type: 'command', id } or { type: 'field', … } exactly as the activity's field
//             dispatches it. Every line is 56 characters or fewer (one Bigger-words page) and kid words.
//   done      the closing line, which ends with the child's turn (for example "Your turn!").
//
// The encounter scene runs the demo (src/ui/demo.js), then restores the child's work. Nothing here saves.
export function demoFor() {
  return null;
}
