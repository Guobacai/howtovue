A common interview question of the Vue is
> What is the difference between Props and Data?

If you search the google, most of the articles would tell you that they have different resposibility like
this [one](https://stackoverflow.com/questions/35548434/component-data-vs-its-props-in-vuejs).
Some articles will also tell you both are reactive.  

All the above answers are correct. However, from technical perspective, `props` is different from the `data`
in terms of whether turning its value into reactive *recursively*.  

To understand this answer, we need to first understand how the `props` is iniitalized.

Do you still remember the `initState` in the `init` function?  
Let's take a look what it does. The `initState` is deined in the `core/instance/state.js`.
```js
export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```
Firstly, it initializes the `_watchers` with an empty array. This `_watchers` saves all `watchers`.  

Then, `initState` will initialize different options by the following sequence:
* Props
* Methods
* Data
* Computed
* Watch

This section only covers the `props` and `methods`. For the rest, each would be worth to use a full section to discuss.  

## Initialize the props

Let's take a look at the `props` first.  
The `initProp` is defined right below the `initState`. It accepts two parameters.
The first one is the component instance. The second one the definitions of `props`.
```js
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    // No matter what, down the road, it calls the `defineReactive`.
    defineReactive(props, key, value)
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}
```
To make it easier to understand, one `if` block in the `for` loop is removed. Because, the `if` block only prints out some warning message in the DEV enviroment. Eventually, both `if` and `else` call `defineReactive`.

At the beginning, the `initProp` initializes three variables on the `vm`  
* `propsData` is initialized as an object. Not only is it defined as a local variable, but also is deinfed on the `vm.$options`. So, any change to local variable `propsData` would also change the `vm.$options.propsData`.
The [`propsData`](https://vuejs.org/v2/api/#propsData) is exposed to developer.
* `_props` is initialized as an object. Same as `propsData`, any change to local variable `props` would be made on `vm._props` as well. 
* `_propsKey` is initialized as an array.  
* `isRoot` is set to `true` when `vm.$parent` is `false`.

When the current `vm` is a children instance, it calls `toggleObserving`.  
```js
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
```
We will talk about this in the later section.
Right now, you could understand this function as key to turn on/off the `Reactivity System`.
If the component isn't the root component, the `Reactivity System` is turn off. Then, why do many people say the `props` is reactive? 
Ok. Be patient and continue to read.  

Next, it comes to a `for` loop.  
```js
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    ...
  }
```
For each prop, it pushes the key to the `keys`.
```js
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
``` 
Since the `keys` points to `vm.$options._propKeys`, it actually saves all the keys of props to `vm.$options._propKeys`.  

Then, it calls the `validateProp` to validate the prop definition.  

## Validate Props

The `validateProp` is defined in the `/core/utils/props.js`.  
```js
export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
  // boolean casting
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // check default value
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    // skip validation for weex recycle-list child component props
    !(__WEEX__ && isObject(value) && ('@binding' in value))
  ) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}
```
`validateProp` is a little bit long. We will exmain it part by part. Let's take a look at the first part.
```js
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
```
The definition of the `prop` is retrieved from `propOptions` which is the second parameter of the `initProps`.  
Then, it checks if the `prop` has any value passed. If there is not, then the variable `absent` is `true`.  
Lastly, the value of `prop` is retrieved from `propsData`.

### Boolean Casting  
A prop could be defiend as both `String` and `Boolean`.
```js
export defaut {
  name: 'Foo',
  props: {
    isChecked: [String, Boolean]
  }
};
```
When using above component `Foo` as the following ways:
```vue
// Using the Boolean prop as an attribute.
<Foo isChecked>
// Binding the Boolean prop with empty string.
<Foo :isChecked="''">
```
Vue has no way to know wheher `isChecked` should be a `Boolean` or `String`.  
To solve this issue, Vue has to cast the `isChecked` to `Boolean` value only if the `Boolean` is defined before the `String`.  

This what the next code does:
```js
// boolean casting
const booleanIndex = getTypeIndex(Boolean, prop.type)
if (booleanIndex > -1) {
  if (absent && !hasOwn(prop, 'default')) {
    value = false
  } else if (value === '' || value === hyphenate(key)) {
    // only cast empty string / same name to boolean if
    // boolean has higher priority
    const stringIndex = getTypeIndex(String, prop.type)
    if (stringIndex < 0 || booleanIndex < stringIndex) {
      value = true
    }
  }
}
```
The `getTypeIndex` is similar to the `Array.prototype.findIndex`.  
If the specific type existed in the `prop.type`, then it returns the index. Otherwise, it returns the `-1`.  
```js
function getTypeIndex (type, expectedTypes): number {
  if (!Array.isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}
```
If the `expectedTypes` isn't an `Array`, then check if `expectedTypes` is same to `type`. Otherwise, it iterates the `expectedTypes` and compare each item with `type`.
If none of the item in `expectedTypes` matches the `type`, then it returns `-1`.  
`isSameType` is defined right above `getTypeIndex`.
```js
function isSameType (a, b) {
  return getType(a) === getType(b)
}
```
`isSameType` is simple. It just compares the type of `a` and `b`. The `getType` is defined above the `isSameType`.
```js
/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}
```
The regular expression `/^\s*function (\w+)/` captures the function name as the first group.  
For example, 
```js
getType(String);
```
The result of `String.toString()` is `function String() {...}` and the first group is `String`.
In case you need to define certain `prop` to be some custmoized class/object, as long as its `toString`
returns the same function name, it is considered as the same type `prop`.  

If the type definition of `prop` has `Boolean`, then it gets into the `if` block.
```js
if (absent && !hasOwn(prop, 'default')) {
  value = false
} else if () {...}
```
If the value of the `prop` is not passed and the `default` value is not defined, then the value of the `prop` is set to `false`. 
Here is the [explaination](http://localhost:8080/vue/shared-utils/#hyphenate) of `hypenate`.  
```js
else if (value === '' || value === hyphenate(key)) {
  // only cast empty string / same name to boolean if
  // boolean has higher priority
  const stringIndex = getTypeIndex(String, prop.type)
  if (stringIndex < 0 || booleanIndex < stringIndex) {
    value = true
}
```
If the value of `prop` is an empty string, or the value equals to the hyphenated `prop` name, then it gets into the `else...if` block.  
It gets the index of `String` in the type of `prop`. If the `String` is not defined in the type of `prop` or if the `Boolean` is
defined before the `String` in the type `prop`, then it set the `value` to `true`.
For example:
```vue
<script>
  export default {
    name: 'foo',
    prop: {
      isDisabled: {
        type: [Boolean, String]
      }
    }
  }
</script>

<template>
  <Foo is-disabled = ''></Foo>
</template>
```
In above example, the value of `isDisabled` is `true`. If the position of `Boolean` and `String` is switched, then, the value of `isDisabled` should be an empty string.

### Default value of prop
```js
if (value === undefined) {
  value = getPropDefaultValue(vm, prop, key)
  ...
}
```
If the value of a `prop` is `undefined` which means the value of this `prop` isn't passed, then it calls `getPropDefaultValue`.
The `getPropDefaultValue` is defined right below `validateProp`.  
```js
/**
 * Get the default value of a prop.
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}
```
1. It checks whether the `default` is defined. If not, it directly returns `undefined`.
```js
if (!hasOwn(prop, 'default')) {
  return undefined
}
```
2. It checks if the default value of `Array` or `Object` is defined as a function.
```js
const def = prop.default
// warn against non-factory defaults for Object & Array
if (process.env.NODE_ENV !== 'production' && isObject(def)) {
  warn(
    'Invalid default value for prop "' + key + '": ' +
    'Props with type Object/Array must use a factory function ' +
    'to return the default value.',
    vm
  )
}
```
When the environment is DEV and the `default` is defined as `Object`,
it prints out the message to warn developer that Object/Array must use a factory function to return the default value.    
`isObject` is different from `isPlainObject` and is defined [here](/vue/shared-utils/#isobject).    

3. Get default value from previous value.  
```js
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
```
`vm.$options.propsData` has the passed value of the `prop`. `vm._props` is key/value pair that stores the value of `prop`.
Therefore, if a `prop` isn't passed any value and its previous value isn't `undefined`, then use prvious value. In case that
a `prop` is an `Array` or `Object`, the factory function will always return a new value which will trigger unnecessary re-rendering.
Using the previous value could avoid this issue.  

4. Calculate the new default value.  
```js
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
```
If the type of prop is `Function`, then its default value shouldn't be called. Otherwise, call the `default` to get the default value.  

`getPropDefaultValue` is done here. Let's go back to `validateProp`.

### Turn the default value to be reactive.
```js
  // since the default value is a fresh copy,
  // make sure to observe it.
  const prevShouldObserve = shouldObserve
  toggleObserving(true)
  observe(value)
  toggleObserving(prevShouldObserve)
```
After we explain how `initData` works, you will fully understand what this code does.  
I will skip this part for now.

### Assert the prop.  
```js
if (
  process.env.NODE_ENV !== 'production' &&
  // skip validation for weex recycle-list child component props
  !(__WEEX__ && isObject(value) && ('@binding' in value))
) {
  assertProp(prop, key, value, vm, absent)
}
```
The first condition of `if` is simple. The second condition might look confusing though. This condition is specifically for `WEEX` platform which we don't cover.
Under the web platform, it gets into the block of `if` and `assertProp` is called.  

The prop definition has two more options `required` and `validator`. Both are handled by `assertProp`.  

1. Handle the `required`.
```js
if (prop.required && absent) {
  warn(
    'Missing required prop: "' + name + '"',
    vm
  )
  return
}
if (value == null && !prop.required) {
  return
}
```
When the prop is `required` but doesn't have any value passed, it prints out the warning message and return.  

When the prop is not `required` and its value is `null` or `undefined`, then it returns. This means if the value of prop is either `null` or `undefined`, then it won't go through the `validator`.
So, in the validator, you don't need to validate whether the value is `null` or `undefined`.
```js
let type = prop.type
let valid = !type || type === true
const expectedTypes = []
```
Three variables are defined - `type`, `valid` and `expectedTypes`.  
`valid` represents whether the prop is valid. In addition to check the type of `prop` is defined, it also needs to compare the value of the `prop` with the definition of `type`. If the definition of `type` isn't correct, it doesn't make any sense to even compare with the value.  
Asumming the `type` is `[String, Number]` or `String`. Then, the `valid` is `false`. If the developer just defines the `type` as `true`, then `!type` is `false` as well. To avoid this, check `type === true`.  
```js
if (type) {
  if (!Array.isArray(type)) {
    type = [type]
  }
  for (let i = 0; i < type.length && !valid; i++) {
    const assertedType = assertType(value, type[i])
    expectedTypes.push(assertedType.expectedType || '')
    valid = assertedType.valid
  }
}
```
It normalizes the `type` to `Array`, then it goes to the `for` loop. Notice the condition of `for` loop is
```js
i < type.length && !valid;
```
As long as it doesn't find the correct `type` (`valid` is false), it keeps checking the next `type`.  
Inside of the loop body, the first statement is
```js
const assertedType = assertType(value, type[i])
```
`assertType` is defined below the `assertProp`.
```js
function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}
```
`getType` is explained [here](http://localhost:8080/vue/reactivity/props.html#validate-props).     

`simpleCheckRE` is defined right above the `assertType`.
```js
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/
```
It is a simple regular expression which check 5 primitive types.  
1. If it is a primitive type, then using `typeof` to check. If it is not valid, then it could be primitive wrapper object, using `instanceof` to check again.  
2. If the `expectedType` is "Object", then only the plain object is valid.  
3. If the `expectedType` is “Array”, then using `Array.isArray` to check.  
4. If the `expectedType` doesn't meet any of above criterias, then directly using `instanceof` to check the type.
This is why in [doc](https://vuejs.org/v2/guide/components-props.html#Type-Checks), it says:
> In addition, type can also be a custom constructor function and the assertion will be made with an instanceof check  
The `assertType` finishes here. Then, it comes to the following two statements:  
```js
  expectedTypes.push(assertedType.expectedType || '')
  valid = assertedType.valid
```
If the `type` is not valid, it is pushed to `expectedTypes` which will be used in the warning message.  

Then, reset the `valid` by `assertedType.valid`. So, as long as it finds the valid type, it quites from the loop.  

When the `for` loop is done, if the `valid` is still `false`, it prints out the `Invalid Type Message`.  

```js
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
```
Next, the `validator` validates the value. If `validator` returns `false`, Vue prints out `Invalid Prop` warning message.  

At last, `validateProp` returns the value.

### Transform the props into reactive
In `initProps`, after `validateProp`, it comes to a `if` block.
```js
if (process.env.NODE_ENV !== 'production') {
  const hyphenatedKey = hyphenate(key)
  if (isReservedAttribute(hyphenatedKey) ||
      config.isReservedAttr(hyphenatedKey)) {
    warn(
      `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
      vm
    )
  }
  defineReactive(props, key, value, () => {
    if (!isRoot && !isUpdatingChildComponent) {
      warn(
        `Avoid mutating a prop directly since the value will be ` +
        `overwritten whenever the parent component re-renders. ` +
        `Instead, use a data or computed property based on the prop's ` +
        `value. Prop being mutated: "${key}"`,
        vm
      )
    }
  })
}
```
The first statement is normalizing the name of `prop` and assign it to constant `hyphenate`.
The `hyphenate` is explained [here](http://localhost:8080/vue/shared-utils/#hyphenate).  

Then, it checks whether the `prop` is a system reserved attribute - `isReservedAttribute`. `isReservedAttribute` is explained [here](http://localhost:8080/vue/shared-utils/#isreservedattribute).

If it is not, it could be a customized reserved attribute - `config.isReservedAttr`. If it is, then Vue prints out a warning message.
```js
/* istanbul ignore else */
if (process.env.NODE_ENV !== 'production') {
  ...
  defineReactive(props, key, value, () => {
    if (!isRoot && !isUpdatingChildComponent) {
      warn(
        `Avoid mutating a prop directly since the value will be ` +
        `overwritten whenever the parent component re-renders. ` +
        `Instead, use a data or computed property based on the prop's ` +
        `value. Prop being mutated: "${key}"`,
        vm
      )
    }
  })
} else {
  defineReactive(props, key, value)
}
```
We can see, no matter what enviroment is, it eventually calls the `defineReactive`. The only difference is `defineReactive` has the forth parameter in the `if` block.

It requires more knowledge about the "Reactivity System" to explain `defineReactive` well. Therefore, we will explain in this [section](http://localhost:8080/vue/reactivity/observer.html).  