Before we start looking at the batch update, the offical doc has a pretty good explanation about how batch update is achieved.  

It is hightly recommended to read this [part](https://vuejs.org/v2/guide/reactivity.html#Async-Update-Queue) first.  

## Queuing a watcher
The `queueWatcher` is defined in the `core/observer/schedule`.
```js
/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
export function queueWatcher (watcher: Watcher) {
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    if (!flushing) {
      queue.push(watcher)
    } else {
      // if already flushing, splice the watcher based on its id
      // if already past its id, it will be run next immediately.
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // queue the flush
    if (!waiting) {
      waiting = true

      if (process.env.NODE_ENV !== 'production' && !config.async) {
        flushSchedulerQueue()
        return
      }
      nextTick(flushSchedulerQueue)
    }
  }
}
```
The `has` is deinfed as an empty object at the beginning of `core/observer/scheduler`. 
If the watcher is already in the `has`, then just skip it. Otherwise, save the new watcher id to `has`. It helps to avoid flushing the duplicated watcher.  
```js
if (!flushing) {
  queue.push(watcher)
} else {
  // if already flushing, splice the watcher based on its id
  // if already past its id, it will be run next immediately.
  let i = queue.length - 1
  while (i > index && queue[i].id > watcher.id) {
    i--
  }
  queue.splice(i + 1, 0, watcher)
}
```
The variable `flushing` indicates whether all the watchers in the queue are executed. Both `queue` and `flushing` are defined as a global variable at the beginning of the file. Therefore, at any time, there is only one queue to flush.  

* If the queue is not flushing, then the watcher is added to the queue.  
* If the queue is flushing, it needs to figure out whether the current watcher has been executed or not by searching the watcher id in the queue.  

To completely understand this part, we need the knowledge about the `flashSchedulerQueue`. So, we will circle back after we explain the `flashSchedulerQueue`. Let see the final part in the `queueWatcher`.
```js
// queue the flush
if (!waiting) {
  waiting = true

  if (process.env.NODE_ENV !== 'production' && !config.async) {
    flushSchedulerQueue()
    return
  }
  nextTick(flushSchedulerQueue)
}
```
If the `waiting` is `falsy`, then set `waiting` to `true`. So, `waiting` is used for controling the critical resource - `queue`.  

If the envrionment is not a production environment and the `config.async` is `false`, then call `flushSchedulerQueue` and return directly.  

Otherwise, it calls the [`nextTick`](https://vuejs.org/v2/api/#vm-nextTick) to schedule the `flushSchedulerQueue`.  

## nextTick
The `nextTick` is exposed as a global api - [`Vue.nextTick`](https://vuejs.org/v2/api/#Vue-nextTick).  
Understanding this api is crictical for understanding the entire updating process.  

`nextTick` is defined in the file `core/util/next-tick`.
```js
export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    timerFunc()
  }
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
```
The `callbacks` is a global variable defined as `Array` at the beginning of this file. 
```js
const callbacks = []
```
An example is easier to explain `nextTick`. Assuming multiple `nextTicket` are called in one function:
```js
function doSomething() {
  this.$nextTick(() => { console.log('task 1');}); // <= Task1
  this.$nextTick(() => { console.log('task 2');}); // <= Task2
  this.$nextTick()
    .then(() => { console.log('task 3');}); // <= Task3
}
```
In abbreviation, we will call each `console.log` as `Task1`, `Task2` and `Task3`.  

Let's see what will happen when the first `nextTick` is called.  

An arrow function is push to `callbacks`. This function defines how to exeucute the `cb`. 
```js
() => {
  if (cb) {
    try {
      cb.call(ctx)
    } catch (e) {
      handleError(e, ctx, 'nextTick')
    }
  } else if (_resolve) {
    _resolve(ctx)
  }
})
js
```
If the `cb` is passed, then it calls the `cb` in a `try...catch` block since the `nextTick` is exposed to developer.
In case the `nextTick` is called without passing `cb`, it calls `_resolve` with `ctx`.
`_resolve` is defined as `null` initially. It will be set to `resolve` function of `Promise` at the end of `nextTick`.
```js
// $flow-disable-line
if (!cb && typeof Promise !== 'undefined') {
  return new Promise(resolve => {
    _resolve = resolve
  })
}
```
In the [official doc](https://vuejs.org/v2/api/#vm-nextTick), there is a note saying:
> New in 2.1.0+: returns a Promise if no callback is provided and Promise is supported in the execution environment.  

1. If the `nextTick` is called with callback - `cb`, then `cb` won't be run. It is just added to the `callbacks`.
2. If the `nextTick` is called with no parameter, it return a promise and set `_resolve` to `resolve` inmmediately.  

**Keep in mind, inside of `nextTick`, this function isn't executed. It will be called until the `callbacks` is flushed.**  

So, in above example, the `callbacks` would be like:
```js
callbacks => Task1 -> Task2 -> Task3 (resolve promise)
```

Next, Let's focus on the most important part of `nextTick` - `timeFunc`. 
```js
if (!pending) {
  pending = true
  timerFunc()
}
```
The `pending` is a global variable which is also defined at top of this file.  
```js
let pending = false
```
When its value is `false`, the `timeFunc` will be called and its value will be set to `true`. 
Thus, the following `nextTick` can't call the `timeFunc`.

Let's see `timerFunc`.  

In the official doc, it explains:
> Internally Vue tries native Promise.then, MutationObserver, and setImmediate for the asynchronous queuing and falls back to setTimeout(fn, 0).
The `timerFunc` points to one of these four strategies. Since the `microtask` is guaranteed to executed before the next `macrotask`, it tries to use the `microtask` as long as the environment offers the function. Here are the strategies code without the comment:
```js
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  timerFunc = () => {
    p.then(flushCallbacks)
    // In problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
  isUsingMicroTask = true
} else if (!isIE && typeof MutationObserver !== 'undefined' && (
  isNative(MutationObserver) ||
  // PhantomJS and iOS 7.x
  MutationObserver.toString() === '[object MutationObserverConstructor]'
)) {
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  // Fallback to setImmediate.
  // Technically it leverages the (macro) task queue,
  // but it is still a better choice than setTimeout.
  timerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else {
  // Fallback to setTimeout.
  timerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}
```
`isNative` is defined in the `core/util/env`. 
```js
export function isNative (Ctor: any): boolean {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}
```
If you are curious why it uses `/native code/` to verify if it is a native implementation, you can find a good anwser [here](https://www.quora.com/What-is-meant-by-a-function-is-native-code-talking-about-JavaScript).  

1. If the environment has `promise` defined, the `timerFunc` uses the `Promise`.
`Promise.resolve` returns a promise and assign it to constant `p`.
Then, the `timerFunc` is set to a function. This function pushes the `flushCallbacks` to the microtask queue. 
For IOS, it does some special operation which is explained well in the comments. Finally, set `isUsingMicroTask` to `true`.  

2. If the environment doens't have `Promise`, then it tries the [`MutationObserver`](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver).
The `MutationObserver` isn't very stable on the IE11, so if it is IE, it doesn't use `MutationObserver`.  
```js
  // Use MutationObserver where native Promise is not available,
  // e.g. PhantomJS, iOS7, Android 4.4
  // (#6466 MutationObserver is unreliable in IE11)
  let counter = 1
  const observer = new MutationObserver(flushCallbacks)
  const textNode = document.createTextNode(String(counter))
  observer.observe(textNode, {
    characterData: true
  })
  timerFunc = () => {
    counter = (counter + 1) % 2
    textNode.data = String(counter)
  }
  isUsingMicroTask = true
```
It create a new `MutationObserver` instance and assign to `observer`. 
Then it create a text node since text node implements the `CharacterData` interface.
It observes the character data of text node. Then, the `timerFunc` is assiend a function which changes the `data` of `textNode`. Thus, it will calls the `flushCallbacks`.
Finally, set `isUsingMicroTask` to `true`.  

3. If the environment doesn't have `MutationObserver` as well, then it falls back to `setImmediate` and `setTimeout` which are relative slower.  

No matter what strategy it uses, all of them push `flushCallbacks` to either microtask or macrotask.  
So, plus the task queue, our example would look like:
```js
callbacks => Task1 -> Task2 -> Task3 (resolve promise)

microtask queue or task(macrotask) queue => flushCallbacks
```
This means, as long as the current callstack is cleaned, the `flushCallbacks` will be called.  

The `flushCallbacks` is defined at the beginning of the file.
```js
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}
```
Firstly, `pending` is set to false. Therefore, after `flushCallbacks`, `nextTick` is able to schedule another `flushCallbacks` again.
Then the variable `copies` saves the copy of `callbacks` and the `callbacks` is cleared.
Finally, it goes through the `copies` and call each function - `Task1`, `Task2` and `Task3`.  

## Flush the schedule queue
In the `core/observer/scheduler`, the callback of `nextTick` is `flushSchedulerQueue`. 
```js
nextTick(flushSchedulerQueue)
```
After this, we could see:
```
schedule queue => watcher1 -> watcher2 -> watcher3 // The scheudler queue holds all the watchers that are needed to be updated.

callbacks => flushSchedulerQueue

microtask queue or task(macrotask) queue => flushCallbacks
```
When `flushCallbacks` is called, it calls `flushSchedulerQueue`. And, `flushSchedulerQueue` will calls each `watcher`.  

The `flushSchedulerQueue` is a little bit long, so we are going to take a look part by part.
```js
function flushSchedulerQueue () {
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  queue.sort((a, b) => a.id - b.id)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}
```
At beginning, `flushSchedulerQueue` defines a few local variables.
```js
function flushSchedulerQueue() {
  currentFlushTimestamp = getNow()
  flushing = true
  let watcher, id

  queue.sort((a, b) => a.id - b.id)
  ...
}
```
Let's ignore `currentFlushTimestamp` first. This is used for performance evaluation which we will address later on.  

The second statement is setting `flushing` to `true`.  

Next, it sorts the `queue` by `id` in ascend order.  

There is a big comment before the sort which is very useful:
>  Sort queue before flush.
>  This ensures that:
>  1. Components are updated from parent to child. (because parent is always
>     created before the child)
>  2. A component's user watchers are run before its render watcher (because
>     user watchers are created before the render watcher)
>  3. If a component is destroyed during a parent component's watcher run,
>     its watchers can be skipped.
When you want to know the order of updating the components, you would understand Vue guarantee the parent component is always updated before the children component.
```js
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }
```
The `for` loop goes through each watcher in the `queue`.  The `index` isn't defined as the local variable of loop.
Instead, it is defined as a global variable at the beginning of this file.
```js
let index = 0
```

**Why is it defined as a global variabled?**

The `index` is used by the `queueWatcher`. We left a few code when we explained the `queueWatcher`.
```js
...
  if (!flushing) {
    ...
  } else {
    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
...
```
Right now, we know `index` is the watcher who is curretly evaludated - `watcher.run` in the scheduler queue.  
It searches from the end of the scheduler queue, if there is still a space existed, then insert this watcher even if the queue is flusing.  

Let's go back to `flushSchedulerQueue`.

First, it gets the watcher from `queue` and assign it to `watcher` variable.  

If `watcher` has `before`, then call the `before`. If you check the Vue document, the `before` hook isn't exposed to user. It is used when the component is updated.  

Then, it removes the watcher from `has`. In `queueWatcher`, if the `has` has the `watcher.id`, the watcher isn't pushed to the `queue`.  

After removing the watcher, it calls `watcher.run`.  

Here is the `run` method:
```js
  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }
```
`run` checks whether the `watcher` is `ative` first. If the watcher is not active, then skip. The `active` is set to `true` when the `watcher` is initialized.  
```js
const value = this.get()
```
This calculates the new value of the `watcher`. The process of getting the value is also the process of collecting the dependents. So, during this process, it will update the dependents of the `watcher`.  

Then, it comes to another `if` condition which has three conditions. Any of the condition is matched would go into the `if` block.  
1. `value !== this.value`: `value` is the new value. `this.value` is the old value.
2. If the `watcher` is watching an object, even if the new value is equal to the old value, it still need to run. `watcher` doesn't do the deep comparision for the sake of the performance.
3. `this.deep` is `true`.

Therefore, if the callback of the `watcher` is heavy, it'd better not watch an object.  

Now, let's take a look at the body of the `if` condition.
```js
  // set new value
  const oldValue = this.value
  this.value = value
  if (this.user) {
    try {
      this.cb.call(this.vm, value, oldValue)
    } catch (e) {
      handleError(e, this.vm, `callback for watcher "${this.expression}"`)
    }
  } else {
    this.cb.call(this.vm, value, oldValue)
  }
```
It saves the old value to local variable `oldValue`. Then, the new value is assigned to `this.value` which updates the value of the `watcher`.  
If the `watcher` is a user-defined `watcher`, then the callback needs to be wrapped inside of the `try...catch`. Otherwise, the callback is directly called.