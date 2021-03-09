Before we get to the `watcher`, let continue to finish the `initState`.  
After `initData`, it comes to initialize the "computed property".
```js
  if (opts.computed) initComputed(vm, opts.computed)
```
"computed property" is well-known for its laziness - cached result.
It won't be re-exectued until one of its dependents is changed.
This is super useful especially for those expensive computation.
Let's see how it achieve this.  
`initComputed` is defined after `initData`.
```js
function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}
```
It acceptes two parameters. The first parameter is an instance of component. The second parameter is computed property definitions.
```js
  const watchers = vm._computedWatchers = Object.create(null)
```
The first statement in `initComputed` is assigning an empty object to `vm._computedWatchers`.
Then it defines a local variable `watchers` and point to `vm._computedWatchers`. Later, any change made on `watchers` is also made on `vm._computedWatchers`.
```js
const isSSR = isServerRendering()
```
`isSSR` stores whether the current environment is server rendering.
Before we move forward, let's see the different ways of defining a computed property.
```vue
<script>
export default {
  computed: {
    fullAddress: function() {
      return this.address1 + this.address2;
    },
    fullName: {
      // getter
      get: function () {
        return this.firstName + ' ' + this.lastName
      },
      // setter
      set: function (newValue) {
        var names = newValue.split(' ')
        this.firstName = names[0]
        this.lastName = names[names.length - 1]
      }
    }
  }
}
</script>
```
The computed property could be defined as `function` or `getter/setter`.
Back to `initComputed`. Next, it starts iterating all the computed properties defined in the `options.computed`.
```js
for (const key in computed) { ... }
```
The body of `for` loop is divided into three parts.
Firstly, it defines two local variables.
```js
  const userDef = computed[key]
  const getter = typeof userDef === 'function' ? userDef : userDef.get
  if (process.env.NODE_ENV !== 'production' && getter == null) {
    warn(
      `Getter is missing for computed property "${key}".`,
      vm
    )
  }
```
`useDef` is the definition of the computed property. According to above example, we know the definition could be a `function` or an `object`.
```js
  const getter = typeof userDef === 'function' ? userDef : userDef.get
```
So, if the computed property is defined as an `object`, then the `getter` is `userDef.get`.  
A computed property must have a `getter`. If it doesn't, Vue prints out a warning message under the development environment.
```js
  if (!isSSR) {
    // create internal watcher for the computed property.
    watchers[key] = new Watcher(
      vm,
      getter || noop,
      noop,
      computedWatcherOptions
    )
  }
```
`isSSR` is used here. If it is not server rendering, it creates a new instance of `Watcher` and assign the new instance to `watchers`. Remember? The `watchers` points to `vm._computedWatchers`. For now, we don't have to know what is the `Watcher`. We only need to know:
1. The computed property is a `Watcher`.
2. All the computed properties are saved in `vm._computedWatchers`.
Let's move to next `if...else` block.
```js
  // component-defined computed properties are already defined on the
  // component prototype. We only need to define computed properties defined
  // at instantiation here.
  if (!(key in vm)) {
    defineComputed(vm, key, userDef)
  } else if (process.env.NODE_ENV !== 'production') {
    if (key in vm.$data) {
      warn(`The computed property "${key}" is already defined in data.`, vm)
    } else if (vm.$options.props && key in vm.$options.props) {
      warn(`The computed property "${key}" is already defined as a prop.`, vm)
    }
  }
```
The `if` checks whether the `key` has been defined on `vm` or the prototype chain of `vm`.
If it does and the environment isn't production, then prints out the warning message if the
`key` has been defined as `data` or `prop`.  
If the `key` hasn't been defined, then it go to the `if` block.
```js
  defineComputed(vm, key, userDef)
```
The `defineComputed` is defined right below `initComputed`.
```js
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
```
If it is not server rendering, the `shouldCache` is `true`.  
If user-defined computed property is a `function`, then
```js
  sharedPropertyDefinition.get = shouldCache
    ? createComputedGetter(key)
    : createGetterInvoker(userDef)
  sharedPropertyDefinition.set = noop
```
`sharedPropertyDefinition` is defined at the beginning of `core/instance/state`.
```js
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}
```
So, all the computed properties are `enumerable` and `configurable`.  
If it is not server rendering, then the `getter` is the returned result of `createComputedGetter`.
```js
function createComputedGetter (key) {
  return function computedGetter () {
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}
```
The `createComputedGetter` returns a function called `computedGetter`.  
Most stuff in `computedSetter` is related to `watcher` which will revisit later on.  
If it is server rendering, the `getter` is the returned value of `createGetterInvoker`.
```js
function createGetterInvoker(fn) {
  return function computedGetter () {
    return fn.call(this, this)
  }
}
```
It also returns the `function`. The function is pretty straight forward. It directly calls the passed in function `fn`.
If the computed property is defined as a `function`. Obviousely, it doesn't have the `setter`. So, the `sharedPropertyDefinition.set` is `noop`.
If the computed property is defined as an `object`, then it goes to `else` block.
```js
  sharedPropertyDefinition.get = userDef.get
    ? shouldCache && userDef.cache !== false
      ? createComputedGetter(key)
      : createGetterInvoker(userDef.get)
    : noop
  sharedPropertyDefinition.set = userDef.set || noop
```
It is a bit more complex than defining as a `function`.  
Instead of just checking whether it should cache, it also check if the `getter` is defined and if the `cache` is `true`.
Therefore, you can disable the cache of a computed property by:
```vue
<script>
  export default {
    computed: {
      fullName: {
        getter() { ... },
        cache: false
      }
    }
  }
</script>
```
After `if...else` block, it is
```js
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
```
If the environment is not a production environment and the `setter` is not set. The `setter` is assigned with a default function.
This function prevents from setting any value and only prints out a warning message if the developer wants to do so.
The last statement in `defineComputed` is
```js
  Object.defineProperty(target, key, sharedPropertyDefinition)
```
Finally, it defines `sharedPropertyDefinition` on `key` property of `target`.