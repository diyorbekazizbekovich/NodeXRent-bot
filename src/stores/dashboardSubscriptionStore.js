const subscriptions = new Map();

function subscribe(chatId, messageId) {
  subscriptions.set(chatId, { messageId, subscribedAt: Date.now() });
}

function unsubscribe(chatId) {
  subscriptions.delete(chatId);
}

function getAll() {
  return subscriptions;
}

function isSubscribed(chatId) {
  return subscriptions.has(chatId);
}

module.exports = { subscribe, unsubscribe, getAll, isSubscribed };
