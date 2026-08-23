<script module>
    import {defineMeta} from '@storybook/addon-svelte-csf';
    import Cell from './Cell.svelte';

    const { Story } = defineMeta({
        title: 'Grid/Cell',
        component: Cell,
        tags: ['autodocs'],
        argTypes: {
            image: { control: 'text' },
            rotation: { control: 'number' },
            fillColour: { control: 'color' },
            size: { control: 'number' }
        },
        args: {
            image: null,
            rotation: 0,
            fillColour: "#4f46e5",
            size: 32
        }
    });
</script>

<Story name="Default" args={{ image: null, rotation: 0, fillColour: "#4f46e5", size: 32 }} />