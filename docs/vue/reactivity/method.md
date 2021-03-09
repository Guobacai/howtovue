In `initState`, after `initProps`, it starts initializing the `methods`.
```js
export function initState (vm: Component) {
  ...
  if (opts.methods) initMethods(vm, opts.methods)
  ...
}
```
As we can see, the user-defined methods are passed as the second parameter to `initMethods`.
The `initMethods` is also defined in the `core/instance/state`.
```js
function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}
```
Firstly, it saves user-defined `props` to the constant `props`. Then, it loops through user-defined methods.  

1. If the environment isn't a production environment and the `method` isn't a function, it prints out a warning message.  
2. If the name of `method` is duplicated with any exiting `prop`, it prints out a warning message.
3. If the name of `method` is duplicated with any variable defined directly on `vm` or it is [reserved by Vue](http://localhost:8080/vue/shared-utils/#isresvered), it prints out a warning message.

Finally, all the methods are saved to `vm`.
```js
vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
```
If the definition of method isn't a function, the mthod will be saved as [an empty function](http://localhost:8080/vue/shared-utils/#noop). Otherwise, the method will be bound to `vm`. This is
why it is not recommended to use arrow function unless you clearly know what context you want to use.

`initMethods` is pretty simple. Its main functionality is avoid have duplicated name with `data` or `props`.