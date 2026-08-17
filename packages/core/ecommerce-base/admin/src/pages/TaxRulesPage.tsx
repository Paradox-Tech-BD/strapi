import * as React from 'react';

import {
  Layouts,
  Page,
  Pagination,
  Table,
  useAPIErrorHandler,
  useFetchClient,
  useNotification,
  type FetchError,
} from '@strapi/admin/strapi-admin';
import {
  Badge,
  Box,
  Button,
  Dialog,
  Field,
  Flex,
  IconButton,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from '@strapi/design-system';
import { Plus, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { useMutation, useQuery } from 'react-query';

import { getTrad } from '../utils';

type TaxRule = {
  id: number | string;
  name: string;
  region: string;
  rate: number | string;
  type: 'inclusive' | 'exclusive';
  active: boolean;
  appliesTo: 'all' | 'physical' | 'digital';
};

type TaxRuleForm = {
  name: string;
  region: string;
  rate: string;
  type: TaxRule['type'];
  appliesTo: TaxRule['appliesTo'];
};

type TaxRuleResponse = {
  results: TaxRule[];
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
  };
};

const emptyForm: TaxRuleForm = {
  name: '',
  region: '',
  rate: '',
  type: 'exclusive',
  appliesTo: 'all',
};

export const TaxRulesPage = () => {
  const { formatMessage } = useIntl();
  const { get, post, del } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { formatAPIError } = useAPIErrorHandler(getTrad);
  const [page, _setPage] = React.useState(1);
  const [isCreateOpen, setCreateOpen] = React.useState(false);
  const [form, setForm] = React.useState<TaxRuleForm>(emptyForm);
  const [ruleToDelete, setRuleToDelete] = React.useState<TaxRule | null>(null);
  const pageSize = 10;

  const { data, isLoading, error, refetch } = useQuery<TaxRuleResponse>(
    ['ecommerce-base', 'tax-rules', page],
    async () => {
      const response = await get<TaxRuleResponse>(
        `/ecommerce-base/tax-rules?page=${page}&pageSize=${pageSize}`
      );
      return response.data;
    },
    {
      onError(fetchError) {
        toggleNotification({
          type: 'warning',
          message: formatAPIError(fetchError as unknown as FetchError),
        });
      },
    }
  );

  const createMutation = useMutation(
    async (input: TaxRuleForm) => {
      const response = await post<TaxRule>('/ecommerce-base/tax-rules', {
        ...input,
        rate: Number(input.rate),
      });
      return response.data;
    },
    {
      onSuccess() {
        toggleNotification({
          type: 'success',
          message: formatMessage({
            id: getTrad('tax-rules.created'),
            defaultMessage: 'Tax rule created',
          }),
        });
        setForm(emptyForm);
        setCreateOpen(false);
        refetch();
      },
      onError(fetchError) {
        toggleNotification({
          type: 'warning',
          message: formatAPIError(fetchError as unknown as FetchError),
        });
      },
    }
  );

  const deleteMutation = useMutation(
    async (id: TaxRule['id']) => {
      await del(`/ecommerce-base/tax-rules/${id}`);
    },
    {
      onSuccess() {
        toggleNotification({
          type: 'success',
          message: formatMessage({
            id: getTrad('tax-rules.deleted'),
            defaultMessage: 'Tax rule deleted',
          }),
        });
        setRuleToDelete(null);
        refetch();
      },
      onError(fetchError) {
        toggleNotification({
          type: 'warning',
          message: formatAPIError(fetchError as unknown as FetchError),
        });
      },
    }
  );

  const updateField =
    (field: keyof TaxRuleForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.region.trim() || !form.rate) {
      toggleNotification({
        type: 'warning',
        message: formatMessage({
          id: getTrad('tax-rules.validation'),
          defaultMessage: 'Name, region, and rate are required',
        }),
      });
      return;
    }
    createMutation.mutate(form);
  };

  if (isLoading) return <Page.Loading />;
  if (error) return <Page.Error />;

  const rules = data?.results ?? [];
  const headers: Table.Header<TaxRule, object>[] = [
    {
      name: 'name',
      label: formatMessage({ id: getTrad('tax-rules.name'), defaultMessage: 'Name' }),
      sortable: true,
    },
    {
      name: 'region',
      label: formatMessage({ id: getTrad('tax-rules.region'), defaultMessage: 'Region' }),
      sortable: true,
    },
    {
      name: 'rate',
      label: formatMessage({ id: getTrad('tax-rules.rate'), defaultMessage: 'Rate' }),
      sortable: true,
    },
    {
      name: 'type',
      label: formatMessage({ id: getTrad('tax-rules.type'), defaultMessage: 'Type' }),
      sortable: true,
    },
    {
      name: 'appliesTo',
      label: formatMessage({ id: getTrad('tax-rules.appliesTo'), defaultMessage: 'Applies To' }),
      sortable: true,
    },
    {
      name: 'active',
      label: formatMessage({ id: getTrad('tax-rules.active'), defaultMessage: 'Active' }),
      sortable: true,
    },
    {
      name: 'actions',
      label: formatMessage({ id: getTrad('tax-rules.actions'), defaultMessage: 'Actions' }),
      sortable: false,
    },
  ];

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage({ id: getTrad('tax-rules.title'), defaultMessage: 'Tax Rules' })}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: getTrad('tax-rules.title'), defaultMessage: 'Tax Rules' })}
        subtitle={formatMessage({
          id: getTrad('tax-rules.subtitle'),
          defaultMessage: 'Manage regional tax rules',
        })}
        primaryAction={
          <Button onClick={() => setCreateOpen(true)} startIcon={<Plus />} size="S">
            {formatMessage({ id: getTrad('tax-rules.create'), defaultMessage: 'Create tax rule' })}
          </Button>
        }
      />
      <Layouts.Content>
        <Table.Root rows={rules} headers={headers} isLoading={isLoading}>
          <Table.Content>
            <Table.Head>
              {headers.map((header) => (
                <Table.HeaderCell key={header.name} {...header} />
              ))}
            </Table.Head>
            <Table.Empty />
            <Table.Loading />
            <Table.Body>
              {rules.map((rule) => (
                <Table.Row key={rule.id}>
                  <Table.Cell>
                    <Typography fontWeight="bold">{rule.name}</Typography>
                  </Table.Cell>
                  <Table.Cell>{rule.region}</Table.Cell>
                  <Table.Cell>{`${(Number(rule.rate) * 100).toFixed(2)}%`}</Table.Cell>
                  <Table.Cell>{rule.type}</Table.Cell>
                  <Table.Cell>{rule.appliesTo}</Table.Cell>
                  <Table.Cell>
                    <Badge>{rule.active ? 'Active' : 'Inactive'}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <IconButton
                      label={formatMessage({
                        id: getTrad('tax-rules.delete'),
                        defaultMessage: 'Delete tax rule',
                      })}
                      onClick={() => setRuleToDelete(rule)}
                    >
                      <Trash />
                    </IconButton>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.Root>
        {rules.length === 0 && (
          <Box padding={8} background="neutral0" shadow="tableShadow" hasRadius marginTop={4}>
            <Typography textColor="neutral600">
              {formatMessage({
                id: getTrad('tax-rules.empty'),
                defaultMessage: 'No tax rules yet.',
              })}
            </Typography>
          </Box>
        )}
        {data?.pagination && (
          <Flex justifyContent="flex-end" marginTop={4}>
            <Pagination.Root
              pageCount={data.pagination.pageCount}
              defaultPage={data.pagination.page}
              defaultPageSize={data.pagination.pageSize}
              total={data.pagination.total}
            >
              <Pagination.Links />
            </Pagination.Root>
          </Flex>
        )}
      </Layouts.Content>

      <Dialog.Root open={isCreateOpen} onOpenChange={setCreateOpen}>
        <Dialog.Content aria-describedby="tax-rule-create-description">
          <Dialog.Header>
            {formatMessage({ id: getTrad('tax-rules.create'), defaultMessage: 'Create tax rule' })}
          </Dialog.Header>
          <Dialog.Description id="tax-rule-create-description">
            {formatMessage({
              id: getTrad('tax-rules.createDescription'),
              defaultMessage: 'Define a regional tax rule for new orders.',
            })}
          </Dialog.Description>
          <form onSubmit={submitForm}>
            <Dialog.Body direction="column" alignItems="stretch" gap={4} padding={6}>
              <Field.Root name="tax-rule-name" required>
                <Field.Label>
                  {formatMessage({ id: getTrad('tax-rules.name'), defaultMessage: 'Name' })}
                </Field.Label>
                <TextInput
                  id="tax-rule-name"
                  value={form.name}
                  onChange={updateField('name')}
                  required
                />
              </Field.Root>
              <Field.Root name="tax-rule-region" required>
                <Field.Label>
                  {formatMessage({ id: getTrad('tax-rules.region'), defaultMessage: 'Region' })}
                </Field.Label>
                <TextInput
                  id="tax-rule-region"
                  value={form.region}
                  onChange={updateField('region')}
                  placeholder="BD or US-CA"
                  required
                />
              </Field.Root>
              <Field.Root name="tax-rule-rate" required>
                <Field.Label>
                  {formatMessage({ id: getTrad('tax-rules.rate'), defaultMessage: 'Rate' })}
                </Field.Label>
                <TextInput
                  id="tax-rule-rate"
                  type="number"
                  min="0"
                  step="0.0001"
                  value={form.rate}
                  onChange={updateField('rate')}
                  placeholder="0.15"
                  required
                />
              </Field.Root>
              <Field.Root name="tax-rule-type" required>
                <Field.Label>
                  {formatMessage({ id: getTrad('tax-rules.type'), defaultMessage: 'Type' })}
                </Field.Label>
                <SingleSelect
                  aria-label="Tax rule type"
                  value={form.type}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, type: value as TaxRule['type'] }))
                  }
                >
                  <SingleSelectOption value="exclusive">Exclusive</SingleSelectOption>
                  <SingleSelectOption value="inclusive">Inclusive</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
              <Field.Root name="tax-rule-applies-to" required>
                <Field.Label>
                  {formatMessage({
                    id: getTrad('tax-rules.appliesTo'),
                    defaultMessage: 'Applies To',
                  })}
                </Field.Label>
                <SingleSelect
                  aria-label="Tax rule applies to"
                  value={form.appliesTo}
                  onChange={(value) =>
                    setForm((current) => ({ ...current, appliesTo: value as TaxRule['appliesTo'] }))
                  }
                >
                  <SingleSelectOption value="all">All</SingleSelectOption>
                  <SingleSelectOption value="physical">Physical</SingleSelectOption>
                  <SingleSelectOption value="digital">Digital</SingleSelectOption>
                </SingleSelect>
              </Field.Root>
            </Dialog.Body>
            <Dialog.Footer padding={4} justifyContent="flex-end" gap={2}>
              <Dialog.Cancel>
                {formatMessage({ id: getTrad('tax-rules.cancel'), defaultMessage: 'Cancel' })}
              </Dialog.Cancel>
              <Dialog.Action type="submit" disabled={createMutation.isLoading}>
                {formatMessage({ id: getTrad('tax-rules.save'), defaultMessage: 'Save tax rule' })}
              </Dialog.Action>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog.Root>

      <Dialog.Root
        open={Boolean(ruleToDelete)}
        onOpenChange={(open) => !open && setRuleToDelete(null)}
      >
        <Dialog.Content aria-describedby="tax-rule-delete-description">
          <Dialog.Header>
            {formatMessage({
              id: getTrad('tax-rules.confirmDelete'),
              defaultMessage: 'Delete tax rule?',
            })}
          </Dialog.Header>
          <Dialog.Description id="tax-rule-delete-description">
            {formatMessage({
              id: getTrad('tax-rules.confirmDeleteDescription'),
              defaultMessage: 'This action cannot be undone.',
            })}
          </Dialog.Description>
          <Dialog.Footer padding={4} justifyContent="flex-end" gap={2}>
            <Dialog.Cancel>
              {formatMessage({ id: getTrad('tax-rules.cancel'), defaultMessage: 'Cancel' })}
            </Dialog.Cancel>
            <Dialog.Action
              disabled={deleteMutation.isLoading}
              onClick={() => ruleToDelete && deleteMutation.mutate(ruleToDelete.id)}
            >
              {formatMessage({ id: getTrad('tax-rules.delete'), defaultMessage: 'Delete' })}
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Page.Main>
  );
};
