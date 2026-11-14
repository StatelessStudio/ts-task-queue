# ts-task-queue

## [Unreleased]

- `TaskPersistence` methods may now be asynchronous (return a `Promise`), enabling persistence backed by external stores
- `QueueOptions.persistenceType` now accepts any class implementing `TaskPersistence`, instead of requiring a subclass of `InMemoryTaskPersistence`
- `Queue.push()` now returns a `Promise` that resolves once the task has been persisted

## [1.0.0]

Initial Release
