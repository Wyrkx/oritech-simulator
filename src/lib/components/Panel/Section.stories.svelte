<script module>
    import { defineMeta } from '@storybook/addon-svelte-csf';
    import Section from './Section.svelte';

    const { Story } = defineMeta({
        title: 'Panel/Section',
        component: Section,
        tags: ['autodocs'],
        args: {
            heading: 'Section Heading',
            collapsible: true,
        },
    })
</script>

<Story name="Collapsible" args={{ heading: 'Collapsible Section', collapsible: true }}>
    <p>This is a collapsible section. Click the toggle button to collapse or expand it.</p>
</Story>

<Story name="Non-Collapsible" args={{ heading: 'Non-Collapsible Section', collapsible: false }}>
    <p>This is a non-collapsible section. It cannot be collapsed or expanded.</p>
</Story>

<Story name="No Heading" args={{ heading: '', collapsible: false }}>
    <p>This section has no heading and is not collapsible.</p>
</Story>