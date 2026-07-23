/**
 * Presentational: the search condition fields.
 *
 * Pure props-to-JSX; the field definitions are passed in so this
 * component stays decoupled from the search screen's configuration.
 */
import { Box, Text } from 'ink';

export type SearchFormLang = 'en' | 'ja';

export type SearchField = {
  readonly key: string;
  readonly label: Readonly<Record<SearchFormLang, string>>;
};

export type SearchFormProps = {
  readonly title: string;
  readonly fields: readonly SearchField[];
  readonly values: Readonly<Record<string, string>>;
  /** Index of the active (editable) field. */
  readonly active: number;
  /** Language for the field labels. */
  readonly lang: SearchFormLang;
};

export function SearchForm({
  title,
  fields,
  values,
  active,
  lang,
}: SearchFormProps) {
  return (
    <Box borderStyle={'round'} flexDirection="column">
      <Text bold>{title}</Text>
      {fields.map((field, index) => (
        <Text key={field.key}>
          {index === active ? '> ' : '  '}
          {field.label[lang]}: [
          <Text color="cyan">{values[field.key] ?? ''}</Text>
          {index === active ? <Text dimColor>█</Text> : null}]
        </Text>
      ))}
    </Box>
  );
}
