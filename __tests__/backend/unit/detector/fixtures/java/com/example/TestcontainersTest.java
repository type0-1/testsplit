package com.example;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.containers.KafkaContainer;

public class TestcontainersTest {

    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15");
    static KafkaContainer kafka = new KafkaContainer("confluentinc/cp-kafka:7.4.0");

    @BeforeAll
    static void startContainers() {
        postgres.start();
        kafka.start();
    }

    @Test
    void testDatabaseConnection() {}

    @Test
    void testKafkaMessage() {}
}
