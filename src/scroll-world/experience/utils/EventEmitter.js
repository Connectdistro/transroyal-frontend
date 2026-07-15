export class EventEmitter {
  constructor() {
    this.callbacks = new Map();
  }

  on(event, callback) {
    if (!this.callbacks.has(event)) this.callbacks.set(event, []);
    this.callbacks.get(event).push(callback);
    return this;
  }

  off(event, callback) {
    if (!this.callbacks.has(event)) return this;
    this.callbacks.set(
      event,
      this.callbacks.get(event).filter((registered) => registered !== callback)
    );
    return this;
  }

  emit(event, ...args) {
    if (!this.callbacks.has(event)) return;
    this.callbacks.get(event).forEach((callback) => callback(...args));
  }
}
