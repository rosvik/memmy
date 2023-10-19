import React, { useEffect, useRef } from 'react';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import { CommentView } from 'lemmy-js-client';
import Comment from '@components/Comment/components/Comment';
import FeedLoadingIndicator from '@components/Feed/components/Feed/FeedLoadingIndicator';
import { useInboxMentions } from '@components/Inbox/hooks/useInboxMentions';

interface IProps {
  selected: number;
}

const renderItem = ({
  item,
}: ListRenderItemInfo<CommentView>): React.JSX.Element => {
  return <Comment itemId={item.comment.id} space />;
};

const keyExtractor = (item: CommentView): string => item.comment.id.toString();

function InboxMentionsTab({ selected }: IProps): React.JSX.Element | null {
  const inboxMentions = useInboxMentions();

  const initialized = useRef(false);

  // Lazy loading
  useEffect(() => {
    if (selected === 1 && !initialized.current) {
      inboxMentions.doLoad();
      initialized.current = true;
    }
  }, [selected]);

  return (
    <FlashList<CommentView>
      renderItem={renderItem}
      data={inboxMentions.data}
      keyExtractor={keyExtractor}
      estimatedItemSize={150}
      ListFooterComponent={
        <FeedLoadingIndicator
          loading={inboxMentions.isLoading}
          error={inboxMentions.isError}
          empty={inboxMentions.isEmpty}
        />
      }
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}

export default React.memo(InboxMentionsTab);
