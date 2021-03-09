# extend
```javascript
export function extend (to: Object, _from: ?Object): Object {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}
```
It merges the properties from `_from` to `to`. If the property in the `_from` already exists in the `to`, then it
will be overwritten.

# toArray 
```javascript
/**
 * Convert an Array-like object to a real Array.
 */
export function toArray (list: any, start?: number): Array<any> {
  start = start || 0
  let i = list.length - start
  const ret: Array<any> = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}
```
Array-like object is an object with property "length".
For instance, string is an Array-like object since it has the property "length".
Firstly, it creates a real array with length `list.length - start`.
Then, it goes to a loop:
```javascript
while (i--) {
  ret[i] = list[i + start]
}
```
`i` is the size of newly generated array. So, it fills the new array backwards - from the end to the start.
Assuming we have a string "Hello".
```javascript
toArray('Hello', 2) // the result is 'llo'
``` 
# makeMap
```javascript
/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  const map = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}
```
It creates an empty object by `Object.create(null)` and assign it to constant `map`.
Then, it splits the `str` by the deliminator "," and assign each item to `map`. 
If the second parameter `expectsLowerCase` is true, then it a function that uses the lowercase as the key.

# isObject
```js
/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
export function isObject (obj: mixed): boolean %checks {
  return obj !== null && typeof obj === 'object'
}
```

# hyphenate
```js
/**
 * Hyphenate a camelCase string.
 */
const hyphenateRE = /\B([A-Z])/g
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})
```
The constant `hyphenate` is the returned value of `cached`. 
Despite the `cached`, the actual functionality is embedded in the function passed to `cached`.
The arrow function only receives a string as parameter. The string is replaced by a regular expression.
1. `/\B([A-Z])/g`: catches the capitalized alphabet if they are not the beginning or the end of a word.
2. `-$1`: Prepend the `-` before the matched group.
For example:  
"helloWORLD" will be transformed into "hello-W-O-R-L-D".  
"helloWorld" will be transformaed into "hello-World".  
Eventually, all the characters will be transformed into lower case.

# cached
```js
/**
 * Create a cached version of a pure function.
 */
export function cached<F: Function> (fn: F): F {
  const cache = Object.create(null)
  return (function cachedFn (str: string) {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }: any)
}
```
If you want to cache any computed result, the first thing you need to do is checking whether the same computation has been done before. 
So, the above `cached` receives a function and return another function at the end.  
The passed function must have the same parameter as the `cached`. Therefore, it can only have one `String` parameter.  
Firstly, it creates a constant `cache` as an empty plain object. Then, the first thing to do in the returned function is checking whether
the passed string is in he `cache`. If it is, it directly returns the cached result - `hit`. Otherwise, it calls the passed `fn` with `str`.

# isReservedAttribute
```js
/**
 * Check if an attribute is a reserved attribute.
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')
```
The following attributes are considered as reserved attribute:
* key
* ref
* slot
* slot-scope
* is

# makeMap
```js
/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
export function makeMap (
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | void {
  const map = Object.create(null)
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase
    ? val => map[val.toLowerCase()]
    : val => map[val]
}
```
`makeMap` has two parameters - `str` and `expectedLowerCase`.  
First, it creates an empty plain object and assign it to constant `map`.
Then, the `str` is split. The result is assigned to constant `list`.
Then, it loops through the `list` and set `map`. The key is the attribute name and
the value is `true`.  

If the `expectedLowerCase` is `true`, then all the keys in the `map` are lower case. 
For example:
```js
const result = makeMap('test,try,catch');
// The result is
// { test: true, try: true, catch: true}
```

# noop
```js
/**
 * Perform no operation.
 * Stubbing args to make Flow happy without leaving useless transpiled code
 * with ...rest (https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/).
 */
export function noop (a?: any, b?: any, c?: any) {}
```
`noop` is an empty function.

# isResvered
```js
/**
 * Check if a string starts with $ or _
 */
export function isReserved (str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}
```
The functionality of this method is documented in the comment.  
It converts the `str` to a string and get its first character. 
Here are the [explaination](https://2ality.com/2012/03/converting-to-string.html) about different ways to convert to a string in Javascript.
According to [Style Guide](https://vuejs.org/v2/style-guide/#Private-property-names-essential), any key prefixed with `$` or `_` is reserved for Vue.

# def
```js
/**
 * Define a property.
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}
```
It simply wraps the `Object.defineProperty`. The third parameter allows to control whether new property is enumerable or not.