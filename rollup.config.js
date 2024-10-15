import typescript from '@rollup/plugin-typescript';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import scss from 'rollup-plugin-scss';

export default {
    input: 'src/ts/main.ts',
    output: {
        dir: 'dist',
        sourcemap: 'inline',
        format: 'cjs',
        exports: 'default'
    },
    external: ['obsidian'],
    plugins: [
        typescript(),
        scss({
            output: "dist/styles.css",
            sourceMap: true,
            watch: "src/styles/*.scss",
        }),
        nodeResolve({browser: true}),
        commonjs(),
        copy({
            targets: [
                { src: "src/manifest.json", dest: "dist" },
            ],
            hook: 'writeBundle'
        })
    ]
};