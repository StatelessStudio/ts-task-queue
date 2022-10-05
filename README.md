# ts-task-queue

Create & queue tasks on a pool of workers.

## Installation

`npm i ts-task-queue`

## Usage

In this example, we'll create a queue that will add two numbers.

### 1. Declare the task interface

Create a file for the queue, `src/add-queue.ts`. In this file, we'll create an interface that will be used for our task.

Our add task will accept two inputs, `a` and `b`, which must both be numbers:

`src/add-queue.ts`
```typescript
export interface AddTask {
	a: number;
	b: number;
}
```

### 2. Create a queue

Our task will take an `AddTask` as input, and output a number (the sum). So we'll create a queue that takes an AddTask as input and returns a number `new Queue<AddTask, number>()`.


`src/add-queue.ts`
```typescript
export interface AddTask {
	a: number;
	b: number;
}

export const addQueue = new Queue<AddTask, number>({

});
```

### 3. Setup the queue

At a minimum, our queue needs a `name` and a `callback`. The name must be a unique string to identify the queue, and the callback is a function that will perform the work that this queue does. The callback must be an async function!

`src/add-queue.ts`
```typescript
export interface AddTask {
	a: number;
	b: number;
}

export const addQueue = new Queue<AddTask, number>({
	name: 'add-queue',
	callback: async (task: AddTask) => task.a + task.b,
});
```

### 4. Use the queue

We can use `addQueue.await()` to push tasks onto the queue and get a Promise back. You most likely will want to wrap your application startup in `Queue.isMainThread()`; so you're not running application code on the worker that should only be run on the main thread:

`src/index.ts`
```typescript
import { AddTask, addQueue } from './add-queue';

if (addQueue.isMainThread()) {
	const sum = await addQueue.await({ a: 4, b: 8 });

	console.log('Sum is', sum);
	// Sum is 12
}
```

### 5. (Optional) Using with ts-node

If you plan to run this through ts-node, you will also need to create a javascript entry-point for the workers:

`./index.js`
```javascript
/**
 * This file boots the worker in dev when the project is run through ts-node.
 *  - This file is not included in the build.
 */
if (!process.execArgv.includes('ts-node/register')) {
    require('ts-node').register();
}

const path = require('path');
require(path.resolve(__dirname, './src/index.ts'));
```

### 6. Using multiple queues

To run different tasks on multiple queues, you can repeat steps 1-4 to create additional queues. Just make sure the name is unique!

`src/subtract-queue.ts`
```typescript

export interface SubtractTask {
	a: number;
	b: number;
};

export subtractQueue = new Queue<SubtractTask, number>({
	name: 'subtract-queue',
	callback: async (task: SubtractTask) => task.a - task.b,
});
```

`src/index.ts`
```typescript
import { AddTask, addQueue } from './add-queue';
import { SubtractTask, subtractQueue } from './subtract-queue';

if (addQueue.isMainThread()) {
	const sum = await addQueue.await({ a: 4, b: 8 });
	console.log('Sum is', sum);
	// Sum is 12
}

if (subtractQueue.isMainThread()) {
	const diff = await subtractQueue.await({ a: 6, b: 4 });
	console.log('Difference is', diff);
	// Difference is 2
}
```

## Customizing the Queue

Use the following options to customize the queue:

### workerEntry

Specify a different file to load the workers. Default is index.js or the main file from package.json

### nWorkers

Number of workers pooled for the queue. Default is 4

### startup

Run a function on worker startup, e.g. establish database connection

### error

Specify an error-handler function. Default logs to stderr

### fatal

Specify a fatal error-handler function. Default logs to stderr and exits
