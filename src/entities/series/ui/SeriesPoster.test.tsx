import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SeriesPoster } from './SeriesPoster';

describe('SeriesPoster', () => {
  it('renders the first letter of the title as a fallback when there is no image', () => {
    render(<SeriesPoster title='Breaking Bad' />);

    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('falls back for an empty/whitespace-only src, not just a missing one', () => {
    render(<SeriesPoster src='   ' title='Friends' />);

    expect(screen.getByText('F')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders an image with the title as alt text when a valid src is given', () => {
    render(
      <SeriesPoster
        src='https://m.media-amazon.com/images/poster.jpg'
        title='The Office'
      />,
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', 'The Office');
    expect(image).toHaveAttribute(
      'src',
      expect.stringContaining('m.media-amazon.com'),
    );
  });

  it('shows "?" for a title with no letters (e.g. an empty string)', () => {
    render(<SeriesPoster title='' />);

    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('picks the same fallback color for the same title on repeated renders', () => {
    const { container: first } = render(<SeriesPoster title='Dexter' />);
    const { container: second } = render(<SeriesPoster title='Dexter' />);

    const firstClasses = first.firstElementChild?.className;
    const secondClasses = second.firstElementChild?.className;
    expect(firstClasses).toBe(secondClasses);
  });
});
