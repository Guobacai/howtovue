---
sidebarDepth: 2
---
In this chapter, we will focus on understanding what happens when we initialize an instance of Vue.
```javascript
const app = new Vue({
  props: {
    title: String
  }
});
```
After open the file `src/core/instance/init`, the first function exported is `initMixin` and it only defines `Vue.prototype._init`.
Let's get rid of the code about measuring the performance for now.
```js
let uid = 0
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    ...

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    ...

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}
```
We know that initializing a Vue component is actually done by this function `_init`. It finishes three major jobs.
1. Merging the options.
2. Initialize each option of a Vue component such as "props", "methods" and "data".
3. Mount the Vue component.
```js
const vm: Component = this
// a uid
vm._uid = uid++
```
First, it points the constant `vm` to the instance of the Vue. Then, it sets the property `_uid` as a number. Since the `uid` is defined in the scope of `init.js`,
the value of `_uid` will be unique.  
Next, it sets the `_isVue` to `true`. As comment indicates this is mainly for avoiding being observed.
This will be explained when we explain the mystery of the reactivity
After this, we come to the first important functionality of the initialization - Merging the options.
Let's ignore the first condition for now, we will come back to this later.
```js
vm.$options = mergeOptions(
  resolveConstructorOptions(vm.constructor),
  options || {},
  vm
)
```
Here, we met the first instance property Vue exposed to user - `vm.$options`. As [document](https://vuejs.org/v2/api/#vm-options) says:
> The instantiation options used for the current Vue instance.

`vm.$options` is the returned value of function `mergeOptions`. In the next chapter, we will explain how Vue merges its different options into `vm.$options`. 
## Merging the options
First of all, let's think one question.  
In the following example, why does `Vue.prototype._init` need to merge the options?
Can we just use the options passed to the Vue to initialize a new Vue instance?
```javascript
const app = new Vue({
  template: '<div></div>',
  props: {
    title: String
  },
  data: {
    fold: true
  }
});
```
Apparently, the answer is it can't. Do you still remember, in the last chapter, we have mentioned there are many stuff 
have been defined on either `Vue` or `Vue.prototype`
```javascript
Vue = {
  util: {
    warn,
    extend,
    mergeOptions,
    defineReactive
  },
  set: function() {...},
  delete: function() {...},
  nextTick: function() {...},
  observable: function() {...},
  options: {
    components: {},
    directives: {},
    filters: {},
  },
  prototype: {
    ...
  }
}
```
So, `mergeOptions` merges the passed options with its parent options. Why is it "parent options", not "Vue"?
Let's see the following example:
```javascript
const ExtendableSpan = Vue.component('extendable-span', {
  props: {
    initiallyExtended: Boolean
  }
});

const extendableSpanInstance = new ExtendableSpan({
  propsData: {
    initiallyExtended: true
  },
  methods: {
    printData() {
      console.log("Hello World");
    }
  }
});
```
In above example, the parent is no longer the `Vue`. Instead, it is a component that extends from the `Vue`. In this case,
the `extendableSpanInstance` needs to have the options of its all ancestors. This is why the first parameter of `mergeOptions`
is
```javascript
resolveConstructorOptions(vm.constructor)
``` 
`resolveConstructorOptions` is defined below `initMixin`.
```javascript
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}
```
In the last example, the `Ctor` is the constructor of `ExpnadableSpan`.
Then, it checks whether the `ExpandableSpan` has parent - `Ctor.super`.  
Does it have? Yes, its parent is `Vue`. If this is previous example - `new Vue()`, then `Ctor.super` doesn't exist.
If you are not familiar with `super`, you can check [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super).
If the Vue class has parent class, then it recursively calls `resolveConstructorOptions` with parent class `Ctor.super`.
In this way, it goes all the way up to the root class and resolve each class's options.
Once it resolves its ancestor's options, it assigns to constant `superOptions`. This is the most fresh (updated) options.
Why do we call it "fresh"? Assuming we have following inheritance chain:
DropdownButton -> MultipleButtons -> Button
If any options is changed in `MultipleButtons`, it should reflect in the `DropdownButton` as well. And, every constructor 
of Vue class has cached the `superOptions` in order to compare if any options has been changed in its ancestors. You may
wonder why can it use `!==` to know if there is any change in the `superOptions`? Let me explain.  
Assuming there isn't any change in the ancestor classes, then all the code inside of `if (superOptions !== cachedSuperOptions)` won't be executed.
The `resolveConstructorOptions` always returns the same `options`.  
```javascript
superOptions !== cachedSuperOptions
```
This only works when injecting the options ([issue 4976](https://github.com/vuejs/vue/issues/4976)). 
For example:
```vue
const BaseButton = Vue.extend({
  name: 'BaseButton',
  props: {
    name: String,
    icon: String
  }
});

BaseButton.options.created = () => { console.log('BaseButton created'); }
Vue.mixin({})
console.log(BaseButton.options.created); // Should print out a function
```
The `BaseButton` is actually a child component of the `Vue`. `Vue.mixin` will create a new `options` object because
`mergeOptions` always returns a new object. As a result, `superOptions` in method `resolveConstructorOptons` is different
from `cachedSuperOptions`. It will executes the code in the `if` block.  
Firstly, it caches the new `superOptions`. Then, it resolves if there is any modified option.
```javascript
  const modifiedOptions = resolveModifiedOptions(Ctor)
```
The definition of method `resolveModifiedOptions` is defined under the `resolveConstructorOptions`.
```javascript
function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
```
The `Ctor.options` is newly resolved options. The `Ctor.sealedOptions` is cached options. By comparing two variables, it
finds the what options have been modified. This is what `for` loop does. All the modified options are saved in the variable
`modified`.  
In `resolveConstructorOptions`, variable `modifiedOptions` stores all modified options of its ancestors on inheritance 
chain.
```javascript
if (modifiedOptions) {
  extend(Ctor.extendOptions, modifiedOptions)
}
```
Then, if there is any `modifiedOptions`, it should be set to the `extendOptions`.
```javascript
options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
  if (options.name) {
  options.components[options.name] = Ctor
}
```
Then, it merges the `Ctor.extendOptions` with `superOptions` and set to `Ctor.options` and local variable `options`.
If it has `options.name`, then sets the current component constructor to `options.components`.

We have spent a lot of time in understanding method `resolveConstructorOptions`. Do you still remember what it does is 
just resolving the first parameter of `mergeOptions`.
```javascript
vm.$options = mergeOptions(
  resolveConstructorOptions(vm.constructor),
  options || {},
  vm
)
```
So, next, we are going to talk about the method `mergeOptions`.

#mergeOptions  
The `mergeOptions` is defined in the `src/core/utils/options`.   
```javascript
/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options
  }

  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }

  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}
```
It has three parameters. The first one is the options of
parent constructor. The second is the options of current constructor. The third parameter is an instance of component.
If it is development environment, then check if the child definition is a valid component.
The next statement could be a little confused.
```javascript
if (typeof child === 'function') {
  child = child.options
}
```
Why is it required?  
Because the [options.extends](https://vuejs.org/v2/api/#extends) allows to pass in either an object or an constructor.
So, here, if the child is a constructor, then, the child should point to constructor's options.  
Next, three functions are called:
```javascript
...
normalizeProps(child, vm)
normalizeInject(child, vm)
normalizeDirectives(child)
...
```
From the name of functions, we can easily know they normalize the `props`, `inject` and `directive`.  
For the convenience of the developers, Vue allows developer to write various forms of above three options.
For example, you can pass `props` as the following various ways:
```vue
Vue.extend({
  ...
  props: {
    text: String,
    list: {
      type: Object,
      default: () => ({})
    }
  }
  ...
});
or
Vue.extend({
  ...
  props: ['text', 'list']
  ...
});
```
All these various formats will be transformed to be object. Let's take a look at the code.
The `normalizeProps` is defined under the `mergeOptions`.
```javascript

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  if (!props) return
  const res = {}
  let i, val, name
  if (Array.isArray(props)) {
    ...
  } else if (isPlainObject(props)) {
    ...
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}
```
If the options doesn't contain `props`, the function directly returns. Then, it declares a few variables.
If the props is an array, then it executes the following code:
```javascript
...
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  }
...
```
It uses `while` to loop through all the `prop`s.
If the type of `prop`'s value is string, then the value will be camelized and use it as the key of final result.  
Otherwise, under the development environment, Vue prints out a warning message.
The above example eventually will be transformed to:
```javascript
{
  ...
  props: ['text', 'item-list']
  ...
};
// This will be transformed to
{
  ...
  props: {
    text: {
      type: null
    }, 
    ItemList: {
      type: null
    } 
  }
  ...
}
```
Let's see what it is going to do with an object format of `props`.
```javascript
if (isPlainObject(props)) {
  for (const key in props) {
    val = props[key]
    name = camelize(key)
    res[name] = isPlainObject(val)
      ? val
      : { type: val }
  }
}
```
It uses `for` to loop through all the `prop`s. The `key` is the name of `prop` and the value could be either an object
or a string the defines the type of the `prop`. If the value is not an object, then it will be transformed to
`{ type: val }`.
```javascript
{
  ...
  props: {
    text: String,
    list: {
      type: Object,
      default: () => ({})
    }
  }
  ...
};
// The above format will be transformed to
{
  ...
  props: {
    text: {
      type: String
    },
    list: {
      type: Object,
      default: () => ({})
    }
  }
  ...
}
```
As we can see, no matter the `props` is an array or an object, eventually, it will be transformed to an object.
If the value of `props` is neither an array nor an object, under the development environment, Vue prints out a
warning message.  
Next, it normalize the `injects`. If you are not familiar with `injects`, 
you can refer to [doc](https://vuejs.org/v2/api/#provide-inject).
According to the document, the `injects` could be an array or an object. Its normalization is pretty much same
to the `props`.
```javascript
/**
 * Normalize all injections into Object-based format
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  if (!inject) return
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}
```
If the `options` doesn't have `inject`, then it directly returns.
Then, it initializes the `options.inject` with an empty object and declare a variable `normalizaed` pointing to
`options.inject`. Thus, any modification to the `normalized` applies to `options.inject` as well.
In case the `options.inject` is an array, like the following:
```vue
{
  ...
  inject: ['foo']
  ...
}
```
The first `if` condition will execute:
```javascript
  ...
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  }
  ...
```
It loops through the `options.inject` and turn every item into an object. The above example will look like the following:
```vue
{
  ...
  inject: {
    foo: {
      from: 'foo'
    }
  } 
  ...
}
```
What if it is an array of symbol? The document doesn't say it could be an array of symbol????????   
The second if condition:
```javascript
...
  else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  }
...
```
If the `inject` is an object, for each key of the object, it runs ternary operation:
```javascript
  normalized[key] = isPlainObject(val)
    ? extend({ from: key }, val)
    : { from: val }
```
If the value is an object, it will extend from `{ from: key }`. 
Otherwise, the value is string, it directly set to `from`.
Here are some examples:
```vue
{
  inject: {
    foo: {
      default: 'defaultValue'
    }
  }
}
// After normalization, it becomes
{
  inject: {
    foo: {
      from: 'foo'
      default: 'defaultValue'
    }
  } 
}
or
{
  inject: {
    foo: {
      from: 'test'
    }
  }
}
// After normalization, it becomes
{
  inject: {
    foo: {
      from: 'test'
    }
  } 
}
or
{
  inject: {
    foo: 'test'
  }
}
// After normalization, it becomes
{
  inject: {
    foo: {
      from: 'test'
    }
  } 
}
```
The final `if` is in case the `inject` is neither an array, nor an object, under the development environment,
it prints out an warning message.
Next, it normalize the `directives`.
```javascript
/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}
```
Normalizing the `directives` is much simpler than other assets. It only deals with the case that a 
[directive is defined as a function](https://vuejs.org/v2/guide/custom-directive.html#Function-Shorthand).
According to the code, if the directive is defined as a function, it means `bind` and `update` shares the
same function.  
Then it comes to apply the `extends` and `mixins`.
```javascript
  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm)
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm)
      }
    }
  }
```
Let see the first if condition `!child._base`. According to the comment "Only merged options has the _base property.", we 
know that the code in the if body will only execute when the `child` is still a plain object. Why? Do you still remember 
there is a function called `initGlobalAPI` which is used for installing all the global api on `Vue`? Let's take a look at
one line ini this function.
```javascript
export function installGlobalAPI(Vue: GlobalAPI) {
...
  Vue.options._base = Vue
...
}
```
It means only the original Vue constructor has the `_base`. So, without using `Vue.extends`, the child options couldn't get `_base`.
In other words, only the merged options through `Vue.extends` could have `Vue.options._base`.
In the if body, it recursively merges the `child.extends` and `child.mixins`.
Then, we come to the last part of the `mergeOptions`.
```javascript
export function mergeOptions(...) {
  ...
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}
```
It declares a constant `options` which is used for storing the final options after merged.  
Then, it goes through the `parent` and `child` to merge the field to the `options`. To avoid merging the same option twice,
if the option has been merged in `parent`, it won't be merged again in `child`. 
Then, it defines a closure called `mergeField`. 
This is a strategy pattern and all the strategies are defined in `strats`. If it is not in `strats`, then it should use
`defaultStrat`.  
In the `options.js`, Vue defines the default strategy for different option. However, the developer can overwrite these strategies
by defining their own. Here is the [document](https://vuejs.org/v2/api/#optionMergeStrategies). At the beginning of the `options.js`
, the `strats` is initialized by `config.optionsMergeStrategies`. 
```javascript
/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
const strats = config.optionMergeStrategies
```
In `config`, the `optionMergeStrategies` is only an object.
```javascript
export default {
  optionMergeStrategies: Object.create(null),
  ...
}
```
The default strategy of each type option is defined in the `options.js`. Let's take a look them one by one.
#Default Strategy
```javascript
...
/**
 * Default strategy.
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}
...
```
The default strategy is overwriting the parent option. If the `childVal` is passed, it uses it. Otherwise, it uses the 
`parentVal`.  
The option `el` and `propsData` use `defaultStat`.
```javascript
/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}
```
Also, all options that are not defined in `strats` will use `defaultStrat`.
# Data & Provide
Let's see how Vue merges the option `data`.
```javascript
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}
```
The strategy `data` function has two execution paths. The difference is whether the third parameter
`vm` is passed. This `vm` comes from the third parameter of `mergeOptions`.  
There are two places that `mergeOptions` isn't called with third parameter.
* Vue.extend
* Vue.mixin
In the body of `if` statement, if the `childVal` isn't a function, Vue prints out a warning message
that 'The "data" options should be a function' and returns `parentVal`. The [document](https://vuejs.org/v2/api/#Vue-extend)
of `Vue.extend` also points out this.  
Even though the document doesn't points out, the `Vue.mixin` should follow the same rule.
If the `childVal` is a function, it calls `mergeDataOrFn` to merge the `data` option from children and parent.
The `vm` is passed only when using `mergeOptions` to initialize `vm.$options`. This is called when creating a new
instance of Vue.  
The actual merge happens in the `mergeDataOrFn`. This function is a little bit longer. So, let get rid of some details
first.
```javascript
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    return function mergedDataFn () {...}
  } else {
    return function mergedInstanceDataFn () {...}
  }
}
```
It is a simple `if...else` statement. If both `childVal` and `parentVal` are passed, the
`data` will eventually be processed as a function - `mergedDataFn` or `mergedInstanceDataFn`.
```javascript
// The `data` will become function `mergedDataFn`
Vue.extend({ name: parentComponent }, { name: 'childComponent' });

// The `data` will become function `mergedInstanceDataFn`
new Vue({
  components: {
    component1: {...}
  }
});
```
What is the difference between `mergedDataFn` or `mergedInstancedDataFn`?  
Let's take a look at the `mergeDataFn` first.
```javascript
// when parentVal & childVal are both present,
// we need to return a function that returns the
// merged result of both functions... no need to
// check if parentVal is a function here because
// it has to be a function to pass previous merges.
return function mergedDataFn () {
  return mergeData(
    typeof childVal === 'function' ? childVal.call(this, this) : childVal,
    typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
  )
}
```
We know the `data` could be either a function or a plain object. So, if the `childVal` or `parentVal` is a function,
call it to get the value. The actual value of `data` will be passed to function `mergeData`. It is defined right above
`mergeDataOrFn`.
```javascript
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal

  const keys = hasSymbol
    ? Reflect.ownKeys(from)
    : Object.keys(from)

  for (let i = 0; i < keys.length; i++) {
    ...
  }
  return to
}
```
This function accepts two object as parameters. If the `from` isn't passed, then directly returns `to`.  
Then, it gets `keys` of `from`. If the environment supports Symbol, then use
[`Reflect.ownKeys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys).
After getting the `keys`, it goes through each key. The actual merge logic happens in the body of loop.
```javascript
function mergeData (to: Object, from: ?Object): Object {
  ...
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    // in case the object is already observed...
    if (key === '__ob__') continue
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (
      toVal !== fromVal &&
      isPlainObject(toVal) &&
      isPlainObject(fromVal)
    ) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}
```
If the object is observed, then it contains '__ob__'. To avoid converting the '__ob__' to a observable, in case the
key is '__ob__', ignore it.  
Then, get the value of `key` in both `from` and `to`. If the `key` is new to `to`, then using `Vue.set` to set this key
on `to` with value from `from` directly.  
Otherwise, if `toVal` isn't strictly equal to `fromVal` and both `toVal` and `fromVal` are plain object, recursively call
`mergeData` again. Eventually, it returns `to`. In case either `toVal` or `fromVal` isn't plain object and they are not
equal, then it uses the `toVal`.  
For instance:
```vue
<script>
export default {
  extends: {
    data() {
      // from
      return {
        name: 'parent',
        display: 'TV',
        address: {
           address1: 'park ave'
        }
      };
    }
  },
  data() {
    // to
    return {
      name: 'child',
      address: {
         zip: '800000'
      }
    };
  }
}
</script>
```
The `keys` are `['name', 'display', 'address']`  
The `display` doesn't exist on `to`, so directly set to `to`.
The `name` exists on `to`, so use the value on `to`.  
Even though 'address' is same on both `from` and `to`. However, the reference isn't the same, so it recursively calls
`mergeData`. So, at the end, the `data` function will be
```javascript
export default {
  data() {
    return {
      name: 'child',
      display: 'TV',
      address: {
        zip: '800000',
        address1: 'Park Ave'
      }     
    };
  }
}
```
We have explained what happens when merging isn't merging the instance data. Let's take a look at the case of "instance
merging".  
Remember in the `mergeDataOrFn`, we have an `else`.
```javascript
if (!vm) {

} else {
  return function mergedInstanceDataFn () {
    // instance merge
    const instanceData = typeof childVal === 'function'
      ? childVal.call(vm, vm)
      : childVal
    const defaultData = typeof parentVal === 'function'
      ? parentVal.call(vm, vm)
      : parentVal
    if (instanceData) {
      return mergeData(instanceData, defaultData)
    } else {
      return defaultData
    }
  }
}
```
What is the difference between the "merging instance data" and "merging through Vue.extend"?
# Watch
All `watcher` will be processed as an array. So the children's `watcher` won't overwrite the parent's `watcher`.
Don't understand why the `parentVal` needs to be extended firstly.

# Props & Methods & Inject & Computed 
The children's options will overwrite the parent's options.
```javascript
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
```
If the `parentVal` doesn't exist, then it directly returns the `childVal`.  
If the both `parentVal` and `childVal` exist, then use children's options to overwrite the parent's options. 
# Lifecycle (hooks)



