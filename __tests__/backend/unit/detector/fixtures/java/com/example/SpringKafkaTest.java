package com.example;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.kafka.test.context.EmbeddedKafka;

@SpringBootTest
@EmbeddedKafka(partitions = 1, topics = {"test-topic"})
public class SpringKafkaTest {

    @Test
    void testProducer() {}

    @Test
    void testConsumer() {}
}
