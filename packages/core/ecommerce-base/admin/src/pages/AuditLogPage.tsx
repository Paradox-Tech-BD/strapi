import * as React from 'react';
import {
  Page,
  Pagination,
  Table,
  useNotification,
  useAPIErrorHandler,
  Layouts,
} from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography } from '@strapi/design-system';
import { useIntl } from 'react-intl';
import { useQuery } from 'react-query';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import type { FetchError } from '@strapi/admin/strapi-admin';
import { getTrad } from '../utils';

type AuditEntry = {
  id: number;
  timestamp: string;
  actor?: string;
  action: string;
  resourceType: string;
  resourceId?: string | number;
  detail?: Record<string, unknown>;
};

export function AuditLogPage() {
  const { formatMessage } = useIntl();
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { formatAPIError } = useAPIErrorHandler(getTrad);
  const [page, setPage] = React.useState(1);
  const pageSize = 25;

  const { data, isLoading, error } = useQuery<{
    results: AuditEntry[];
    pagination: { page: number; pageCount: number };
  }>(
    ['ecommerce-base', 'audit', page],
    async () => {
      const { data } = await get(`/ecommerce-base/audit?page=${page}&pageSize=${pageSize}`);
      return data as { results: AuditEntry[]; pagination: { page: number; pageCount: number } };
    },
    {
      onError(err) {
        toggleNotification({
          type: 'warning',
          message: formatAPIError(err as unknown as FetchError),
        });
      },
    }
  );

  if (isLoading) return <Page.Loading />;
  if (error) return <Page.Error />;

  const entries = data?.results ?? [];

  const headers: Table.Header<AuditEntry, object>[] = [
    {
      name: 'timestamp',
      label: formatMessage({ id: getTrad('audit.when'), defaultMessage: 'When' }),
      sortable: true,
    },
    {
      name: 'actor',
      label: formatMessage({ id: getTrad('audit.actor'), defaultMessage: 'Actor' }),
      sortable: false,
    },
    {
      name: 'action',
      label: formatMessage({ id: getTrad('audit.action'), defaultMessage: 'Action' }),
      sortable: true,
    },
    {
      name: 'resource',
      label: formatMessage({ id: getTrad('audit.resource'), defaultMessage: 'Resource' }),
      sortable: false,
    },
  ];

  return (
    <Page.Main>
      <Page.Title>
        {formatMessage({ id: getTrad('plugin.audit'), defaultMessage: 'Audit Log' })}
      </Page.Title>
      <Layouts.Header
        title={formatMessage({ id: getTrad('plugin.audit'), defaultMessage: 'Audit Log' })}
        subtitle={formatMessage({
          id: getTrad('audit.subtitle'),
          defaultMessage: 'State-changing actions performed by administrators',
        })}
      />
      <Layouts.Content>
        <Table.Root rows={entries} headers={headers} isLoading={isLoading}>
          <Table.Content>
            <Table.Head>
              {headers.map((header) => (
                <Table.HeaderCell key={header.name} {...header} />
              ))}
            </Table.Head>
            <Table.Empty />
            <Table.Loading />
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.id}>
                  {headers.map((header) => {
                    switch (header.name) {
                      case 'timestamp':
                        return (
                          <Table.Cell key={header.name}>
                            <Typography textColor="neutral600">
                              {new Date(entry.timestamp).toLocaleString()}
                            </Typography>
                          </Table.Cell>
                        );
                      case 'actor':
                        return <Table.Cell key={header.name}>{entry.actor ?? '—'}</Table.Cell>;
                      case 'action':
                        return (
                          <Table.Cell key={header.name}>
                            <Typography>
                              {entry.action}
                              {entry.detail?.newStatus
                                ? ` → ${entry.detail.newStatus}`
                                : entry.detail?.newQuantity !== undefined
                                  ? ` (${(entry.detail.newQuantity as number) >= 0 ? '+' : ''}${entry.detail.delta})`
                                  : ''}
                            </Typography>
                          </Table.Cell>
                        );
                      case 'resource':
                        return (
                          <Table.Cell key={header.name}>
                            {`${entry.resourceType}${entry.resourceId ? ` #${entry.resourceId}` : ''}`}
                          </Table.Cell>
                        );
                      default:
                        return <Table.Cell key={header.name} />;
                    }
                  })}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.Root>
        {entries.length === 0 && !isLoading && (
          <Box padding={8} background="neutral0" shadow="tableShadow" hasRadius marginTop={4}>
            <Typography textColor="neutral600">
              {formatMessage({
                id: getTrad('audit.empty'),
                defaultMessage: 'No audit entries yet.',
              })}
            </Typography>
          </Box>
        )}
        {(data?.pagination?.pageCount ?? 0) > 1 && (
          <Flex justifyContent="flex-end" marginTop={4}>
            <Pagination.Root {...data!.pagination}>
              <Pagination.Links />
            </Pagination.Root>
          </Flex>
        )}
      </Layouts.Content>
    </Page.Main>
  );
}
