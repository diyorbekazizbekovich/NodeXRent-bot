/** Bir xabar bir nechta listenerda qayta ishlanmasin */
const handledKeys = new Set();

function keyOf(msg) {
  return `${msg.chat?.id}:${msg.message_id}`;
}

function markMessageHandled(msg) {
  if (!msg?.message_id) return;
  const key = keyOf(msg);
  handledKeys.add(key);
  setTimeout(() => handledKeys.delete(key), 120000);
}

function wasMessageHandled(msg) {
  if (!msg?.message_id) return false;
  return handledKeys.has(keyOf(msg));
}

module.exports = { markMessageHandled, wasMessageHandled };
