The reactivity system implements [Observer Pattern](https://en.wikipedia.org/wiki/Observer_pattern).  

Let's take a look at a simple use case.

Assuming we want to prints out the user's address whenever the address is changed.
```js
user = {
  address: '1 main street'
};

function printUserAddress() {
  console.log('Address: ', user.address);
}
```
Whenever the `user.address` is changed, function `printUserAddress` should be called.  
In Vue, we could watch `user.address` and pass function `printUserAddress` as the callback.
```js
it.watch(user, 'address' printUserAddress);
```
To achieve this, we need to finish the followings:
1. `it` will get notification when `user.address` is changed.
2. When the `user.address` is really changed, then `it` should call callback `priintUserAddress`.

## Detect the change on subject.
In above example, according to `Observer Pattern`, the subject is `user.address`. And, the `Observer` is `it`.
The `Observer` is also called the dependent of the subject.  

Therefore, to collect the dependents, we must know where is `user.address` used. How can we know it?  

Luckily, for an object, the Javascropt offers the `getter/setter` to any property of the object.
Through wrapping the `getter/setter`, we could collect the depedent when the subject is read and notify
the dependent when the value of the subject is changed.
```js
const deps = [];

// This class represents a dependent.
class Dep {};

function defineReactiveUserAddress() {
  Object.defineProperty(user, 'address', {
    ...
    getter() {
      // Initializing the dependent instance.
      dependent = new Dep();
      // collecting the dependent here.
      deps.push(dependent);
      return this['address'];
    }
  });
}
```
When and only when the property `address` is read, an instance of `Dep` is push to the list of `deps`.
Collecting the dependent is done.  

## Notify the dependent when the subject is changed.
On the other side, the *Reactivity System* needs to respond to the change of `user.address`.
We could achieve this by using the `setter`.
```js
const deps = [];

// This represents a dependent.
class Dep {
  notify() {
    printUserAddress();
  }
};

function defineReactiveUserAddress() {
  Object.defineProperty(user, 'address', {
    ...
    getter() {
      // Initializing the dependent instance.
      dependent = new Dep();
      // collecting the dependent here.
      deps.push(dependent);
      return this['address'];
    },
    setter(value) {
      if (this.address !== value) {
        // update to the new value.
        this.address = value;
        // This eventually calls printUserAddress();
        deps[0].notify();
      }
    }
  });
}
```
So far, this simple *Reactivity System* is able to collect the dependents and is aware of the change of subject.
But, the `printUserAddress` is hardcoded in the `dep.notify()` which is not practical. We could create a `watcher` to solve this issue:
```js
// The global watcher.
let watcher;

// This represents a dependent.
class Dep {
  notify() {
    watcher.do();
  }

  depend() {}
};

// A watcher watches the change of one or more dependents.
class Watcher {
  constructor(callback) {
    this.callback = callback;
  },

  do() {
    this.callback();
  }
}

function defineReactiveUserAddress() {
  const dep = new Dep();

  Object.defineProperty(user, 'address', {
    ...
    getter() {
      // collecting the dependents here.
      dep.depend(watcher);
      return this['address'];
    },
    setter(value) {
      if (this.address !== value) {
        this.address = value;
        // This eventually calls printUserAddress();
        dep.notify();
      }
    }
  });
}

// Create a new instance of watcher
function watch(obj, prop, callback) {
  watcher = new Watcher(callback);
}
```
## Other issues
There are also many other issues embedded in above code including, but not limit to, the following:
1. What if the value of the `user.address` is an object, not a native value?
2. How does the callback avoid being called for duplicated times?
3. How to handle in case the subject is an `Array`.

We will walk through how the Vue solves above challenges in the following sections.

In addition to the `Reactivity System`, we will also address the `props` and `computed properties`.
Both are frequently used in our daily work. I am sure, after reading these sections, you will have 
much better understanding on how they work.