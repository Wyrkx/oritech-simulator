<script module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import Grid from './Grid.svelte';

    const { Story } = defineMeta({
        title: 'Grid/Grid',
        component: Grid,
        tags: ['autodocs'],

        parameters: {
            layout: 'centered'
        },

        argTypes: {
            width: { control: 'number' },
            height: { control: 'number' },
            draggable: { control: 'boolean' },
            onCellSelected: { action: 'cell selected' }
        },

        args: {
            width: 5,
            height: 5,
            draggable: false,
            onCellSelected: () => {}
        }
    });
</script>

<Story name="Default" args={{ width: 8, height: 8 }} />