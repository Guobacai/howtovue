From this chapter, we will start the journey to explore the reactivity.  

There are two steps to make the data to react to certain change:  
* Transform the "data" into reactive data.
* "Watch" the reactive data.

This charpter and next chapter focus on the first step.  
The chapter "Watcher" will discuss how `watcher` watches the reactive data and respond to the change.  

In `initState`, after `initMethods`, it comes to `initData`.
```js
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
```
If the component doesn't have the `data` defined, instead of calling `initData`, `observe` is called. If the component has the `data` defined, then `initData` is called.  

**Why doesn't directly call `initData` for both cases?**  

Because `initData` has some extra work to do. At the end, `initData` will call `observe` as well. Let's take
a look at `initData` firstly.
```js
function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function'
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}
```
At first glance, this method looks complicated. No worry. Most logic is related to print warning message under the development env.
After getting rid of these code, the functionality is pretty simple.  

First, it saves `vm.$options.data` to local variable `data`.  

If the `data` is defined as `function`, it calls `getData`. Otherwise, it just uses the `data`. In case `data` is `falsy`, `data` is assigned as an empty object.  

## Get the data of 'vm.$options.data'
In most cases, the `vm.$options.data` is defined as a `function`. So, `getData` will be called.  

The `getData` is defined right below `initData`.
```js
export function getData (data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}
```
Here, we encounter the first important methods of reactivity - `pushTarget` and `popTarget`. Both are defined in the `core/observer/dep`.
```js
// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack = []

export function pushTarget (target: ?Watcher) {
  targetStack.push(target)
  Dep.target = target
}

export function popTarget () {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
```
From their names, it is really hard to figure out what both methods do. `push` and `pop` are easy to understand.  

**What does `Target` mean here?**  

There is a static property defined on the `Dep` class:
```js
export default class Dep {
  static target: ?Watcher
  ...
}
```
It is initialized as `null`.
```js
Dep.target = null
```
This is the target that `pushTarget` and `popTarget` operates on. From the flow definition, we can interperet that `Dep.target` points to
a `Watcher`. Since at any given time, there is only one `Watcher` can be evaluated, therefore, `target` is a static property. If you don't
fully understand this part, don't worry. After reading the chapter of watcher, you will have a better understanding.

`pushTarget` does two simple things:
1. Push `target` to `targetStack`.
2. Assign `target` to `Dep.target`.

`popTarget` does the exactly the oppisite things:
1. Pop the `targetStack`.
2. Assign the top `target` in the `targetStack` to `Dep.target`.

Both `Dep.target` and `targetStack` are defined as global variables which means there is only one `target` assigned to `Dep.target`.
According to the comments, that is because only one watcher can be evaluated and collect the dependents at any given time.  

In `getData`, the `pushTarget` is called without passing any parameter. Therefore, `Dep.target` is `undefined`.
Next, within a `try...catch...finally` block, the `data` is called. Since the `Dep.target` is `undefined`, none of any `watcher` is collecting the dependents. This is 
the way of disabling the collection of dependents. Of course, if the data isn't collected as dependent, any change on this data won't trigger any other change as well.

For more details about why it needs to do so, please refer to [#7573](https://github.com/vuejs/vue/issues/7573).  
TL;DR;  
In the example of ticket, if the `msg` is collected as dependent of `data`, when the `msg` is changed, the `data` function will run again which is not necessary.

When the dependent collection is done, it calls `popTarget` to reset the `Dep.target` to the last `watcher`.  

The reason `data.call(vm, vm)` wrapped inside of the `try...catch` is because `data` is defined by developer. There is no way to know how developer defines the `data`.  
If there is not expection thrown out, `getData` returns the result of `data.call`. Otherwise, it returns an empty object.

If the `data` function doesn't return a plain object, Vue force to set `data` to be an empty object. Under the non-production environment, it prints out a warning message.

## Validate the data
After get the value of `data` function, it needs to validate the result.
```js
// proxy data on instance
const keys = Object.keys(data)
const props = vm.$options.props
const methods = vm.$options.methods
let i = keys.length
while (i--) {
  const key = keys[i]
  if (process.env.NODE_ENV !== 'production') {
    if (methods && hasOwn(methods, key)) {
      warn(
        `Method "${key}" has already been defined as a data property.`,
        vm
      )
    }
  }
  if (props && hasOwn(props, key)) {
    process.env.NODE_ENV !== 'production' && warn(
      `The data property "${key}" is already declared as a prop. ` +
      `Use prop default value instead.`,
      vm
    )
  } else if (!isReserved(key)) {
    proxy(vm, `_data`, key)
  }
}
```
Firstly, it saves all the keys of `data` as an array to constant `keys`. It also saves the `vm.$options.props` and `vm.$options.methods` to constant `props` and `methods` respectively.
Then, it checks if any `data` property has already been defined as a `prop` or `method`. If the property has been used, then prints out the warning message under non-production environment.
Otherwise, check if the property is system reserved. If not, proxy each key on `_data`.  

## Proxy the data
`proxy` is defined at the beninning of `core/instance/state`.
```js
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

export function proxy (target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
```
`proxy` has three parameters.
1. `target`: The target object.
2. `sourcekey`: The original key.
3. `key`: The target key.

Firstly, `proxy` sets the `getter/setter` of `sharedPropertyDefinition`. The `getter` reads the data from `sourceKey` and `setter` will set the data to `sourceKey`.  
`sharedPropertyDefinition` has default value - `enumerable = true` and `configurable = true`. Therefore, all proxied properties are enumerable and configurable.  

For example:
```js
proxy(vm, `_data`, `address`)
```
`vm.address` is actually `vm._data.address`.

After proxying the `data`, it starts observing the `data`.
```js
// observe data
observe(data, true /* asRootData */)
```
You see, this is the same as the `data` isn't defined in the `initState`. The only difference is, the first parameter of `observe` is not an empty object. 
```js
if (opts.data) {
  initData(vm)
} else {
  observe(vm._data = {}, true /* asRootData */) <=
}
```

As of now, the `initData` is fully explained. We learned:
1. No matter whether the `data` is defined, `observe` will be called at the end. 
2. In `initData`, before `observe`, it only does a few preparation work. Nothing is related to reactivty. So, it must be `observe` to turn `data` into reactive.

Let's dive into method `observe`. 