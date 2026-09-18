global.window = {};
import('./core/task-parser.js').then(() => {
  const parse = global.window.TaskParser.parse;
  const now = new Date(2023, 9, 15, 12, 0);
  console.log(parse('Quick task due +15m', { now }));
});
