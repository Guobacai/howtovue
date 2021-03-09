module.exports = {
  title: "Vue Explanation",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/'},
      { text: 'Vue', link: '/vue/'}
    ],
    sidebar: [
      // {
      //   title: 'Initialization',
      //   path: '/vue/initialization/',
      //   children: [
      //     ['/vue/initialization/import-vue', 'Import Vue'],
      //     ['/vue/initialization/new-vue', 'Create an instance of Vue']
      //   ]
      // },
      {
        title: 'The mystery of Reactivity',
        path: '/vue/reactivity/',
        children: [
          ['/vue/reactivity/simple-case', 'A simpler reactivity system'],
          ['/vue/reactivity/props', 'Props'],
          ['/vue/reactivity/method', 'Methods'],
          ['/vue/reactivity/data', 'Initialize Data'],
          ['/vue/reactivity/observer', 'Observe Data'],
          ['/vue/reactivity/watcher', 'Watcher'],
          ['/vue/reactivity/batch-update', 'Batch Update']
        ]
      },
      {
        title: 'Shared Utils',
        path: '/vue/shared-utils/',
      }
    ]
  }
};
