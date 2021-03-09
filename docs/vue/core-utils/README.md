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
`def` simply wraps the `Object.defineProperty`.
`def` receives four parameters. The first three paraemters - `obj`, `key` and `val` are required.
The last parameter `enumerable` is optional. If `enumerable` is not passed, then the defined `key`
is not enumerable. Thus, `for...in` or `Object.keys` won't return this property.